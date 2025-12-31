// Twitter GIF Grabber - Background Service Worker

// State
let conversionQueue = [];
let isProcessing = false;

// Track active conversions for progress forwarding
const activeConversions = new Map(); // tweetId -> tabId

// Listen for messages from content script and offscreen
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CONVERT_GIF') {
    activeConversions.set(message.data.tweetId, sender.tab.id);
    handleConversion(message.data, sender.tab.id);
    sendResponse({ status: 'queued' });
  } else if (message.type === 'CONVERT_AND_COPY') {
    activeConversions.set(message.data.tweetId, sender.tab.id);
    handleConvertAndCopy(message.data, sender.tab.id);
    sendResponse({ status: 'queued' });
  } else if (message.type === 'DOWNLOAD_MP4') {
    handleDownloadMp4(message.data);
    sendResponse({ status: 'queued' });
  } else if (message.type === 'GIF_PROGRESS') {
    // Forward progress from offscreen to content script
    const tabId = activeConversions.get(message.tweetId);
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: 'CONVERSION_STATUS',
        tweetId: message.tweetId,
        status: 'progress',
        progress: message.progress
      });
    }
  } else if (message.type === 'GET_HISTORY') {
    getHistory().then(sendResponse);
    return true;
  } else if (message.type === 'CLEAR_HISTORY') {
    clearHistory().then(sendResponse);
    return true;
  } else if (message.type === 'DELETE_HISTORY_ITEM') {
    deleteHistoryItem(message.index).then(sendResponse);
    return true;
  } else if (message.type === 'TOGGLE_PIN_HISTORY_ITEM') {
    togglePinHistoryItem(message.index).then(sendResponse);
    return true;
  } else if (message.type === 'GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true;
  } else if (message.type === 'SAVE_SETTINGS') {
    saveSettings(message.data).then(sendResponse);
    return true;
  }
});

// Handle MP4 download
async function handleDownloadMp4(data) {
  const { videoUrl, tweetId, tweetUrl } = data;
  const filename = `twitter-${tweetId}.mp4`;
  
  chrome.downloads.download({
    url: videoUrl,
    filename: filename,
    saveAs: false
  });
  
  // Save to history
  await addToHistory({
    tweetId,
    tweetUrl: tweetUrl || `https://x.com/i/status/${tweetId}`,
    filename,
    size: 0, // Unknown size for direct download
    date: Date.now(),
    type: 'downloaded'
  });
}

// Handle conversion request
async function handleConversion(data, tabId) {
  const { tweetUrl, videoUrl, tweetId } = data;
  
  try {
    // Update badge
    chrome.action.setBadgeText({ text: '...' });
    chrome.action.setBadgeBackgroundColor({ color: '#1DA1F2' });
    
    // Notify content script
    chrome.tabs.sendMessage(tabId, {
      type: 'CONVERSION_STATUS',
      tweetId,
      status: 'downloading'
    });
    
    // Download video
    const videoResponse = await fetch(videoUrl);
    const videoBlob = await videoResponse.blob();
    
    // Notify progress
    chrome.tabs.sendMessage(tabId, {
      type: 'CONVERSION_STATUS',
      tweetId,
      status: 'converting'
    });
    
    // Get settings
    const settings = await getSettings();
    
    // Convert to GIF using OffscreenDocument
    const gifBase64 = await convertVideoToGif(videoBlob, settings, tweetId);
    
    // Clean up active conversion tracking
    activeConversions.delete(tweetId);
    
    // Create download using data URL (URL.createObjectURL not available in SW)
    const dataUrl = `data:image/gif;base64,${gifBase64}`;
    const filename = `twitter-gif-${tweetId}.gif`;
    
    chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: false
    });
    
    // Save to history (estimate size from base64)
    const estimatedSize = Math.round(gifBase64.length * 0.75);
    await addToHistory({
      tweetId,
      tweetUrl,
      filename,
      size: estimatedSize,
      date: Date.now(),
      type: 'downloaded'
    });
    
    // Update badge
    chrome.action.setBadgeText({ text: '' });
    
    // Notify success
    chrome.tabs.sendMessage(tabId, {
      type: 'CONVERSION_STATUS',
      tweetId,
      status: 'done'
    });
    
    // Show notification
    if (settings.showNotifications) {
      try {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
          title: 'GIF Downloaded',
          message: `${filename} saved successfully`
        });
      } catch (e) {
        // Notifications might fail silently
      }
    }
    
  } catch (error) {
    console.error('Conversion error:', error);
    
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
    
    chrome.tabs.sendMessage(tabId, {
      type: 'CONVERSION_STATUS',
      tweetId,
      status: 'error',
      error: error.message
    });
    
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
  }
}

// Handle convert and copy link request
async function handleConvertAndCopy(data, tabId) {
  const { tweetUrl, videoUrl, tweetId } = data;
  
  try {
    // Update badge
    chrome.action.setBadgeText({ text: '...' });
    chrome.action.setBadgeBackgroundColor({ color: '#888' });
    
    // Notify content script
    chrome.tabs.sendMessage(tabId, {
      type: 'CONVERSION_STATUS',
      tweetId,
      status: 'downloading'
    });
    
    // Download video
    const videoResponse = await fetch(videoUrl);
    const videoBlob = await videoResponse.blob();
    
    // Notify progress
    chrome.tabs.sendMessage(tabId, {
      type: 'CONVERSION_STATUS',
      tweetId,
      status: 'converting'
    });
    
    // Get settings
    const settings = await getSettings();
    
    // Convert to GIF
    const gifBase64 = await convertVideoToGif(videoBlob, settings, tweetId);
    
    // Upload to imgbb via site API
    chrome.tabs.sendMessage(tabId, {
      type: 'CONVERSION_STATUS',
      tweetId,
      status: 'uploading'
    });
    
    const gifBlob = base64ToBlob(gifBase64, 'image/gif');
    const formData = new FormData();
    formData.append('fileToUpload', gifBlob, `${tweetId}.gif`);
    formData.append('name', `twitter-gif-${tweetId}`);
    
    // Use the site's upload API
    const uploadResponse = await fetch('https://hiii.boo/gif/api/upload', {
      method: 'POST',
      body: formData
    });
    
    const uploadResult = await uploadResponse.json();
    
    if (uploadResult.error) {
      throw new Error(uploadResult.error);
    }
    
    const gifUrl = uploadResult.url;
    
    // Save to history
    const estimatedSize = Math.round(gifBase64.length * 0.75);
    await addToHistory({
      tweetId,
      tweetUrl,
      filename: `twitter-gif-${tweetId}.gif`,
      size: estimatedSize,
      date: Date.now(),
      type: 'copied',
      url: gifUrl
    });
    
    // Update badge
    chrome.action.setBadgeText({ text: '' });
    
    // Send URL to content script for copying
    chrome.tabs.sendMessage(tabId, {
      type: 'COPY_TO_CLIPBOARD',
      tweetId,
      url: gifUrl
    });
    
  } catch (error) {
    console.error('Convert and copy error:', error);
    
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#a55' });
    
    chrome.tabs.sendMessage(tabId, {
      type: 'CONVERSION_STATUS',
      tweetId,
      status: 'error',
      error: error.message
    });
    
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
  }
}

// Helper: Base64 to Blob
function base64ToBlob(base64, type) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type });
}

// Convert video to GIF using offscreen document
async function convertVideoToGif(videoBlob, settings, tweetId) {
  // Create offscreen document for canvas operations
  const offscreenUrl = 'lib/offscreen.html';
  
  // Check if offscreen document exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  
  if (!existingContexts.length) {
    await chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: ['BLOBS'],
      justification: 'Convert video to GIF using canvas'
    });
  }
  
  // Convert blob to base64 for transfer (blobs can't be serialized in messages)
  const arrayBuffer = await videoBlob.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);
  
  // Send to offscreen document for processing
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_CONVERT',
      videoBase64: base64,
      videoType: videoBlob.type,
      settings,
      tweetId
    }).then(response => {
      if (response.error) {
        reject(new Error(response.error));
      } else {
        // Return base64 directly (no blob conversion in SW)
        resolve(response.gifBase64);
      }
    }).catch(err => {
      reject(new Error('Offscreen conversion failed: ' + err.message));
    });
  });
}

// Helper: ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Storage helpers
async function getHistory() {
  const result = await chrome.storage.local.get('history');
  return result.history || [];
}

async function addToHistory(item) {
  const history = await getHistory();
  history.unshift(item);
  // Keep last 50 items
  if (history.length > 50) history.pop();
  await chrome.storage.local.set({ history });
}

async function clearHistory() {
  await chrome.storage.local.set({ history: [] });
  return { success: true };
}

async function deleteHistoryItem(index) {
  const history = await getHistory();
  if (index >= 0 && index < history.length) {
    history.splice(index, 1);
    await chrome.storage.local.set({ history });
  }
  return { success: true };
}

async function togglePinHistoryItem(index) {
  const history = await getHistory();
  if (index >= 0 && index < history.length) {
    history[index].pinned = !history[index].pinned;
    await chrome.storage.local.set({ history });
  }
  return { success: true };
}

async function getSettings() {
  const result = await chrome.storage.sync.get('settings');
  return result.settings || {
    quality: 10,
    maxWidth: 480,
    fps: 15,
    showNotifications: true,
    autoDownload: true
  };
}

async function saveSettings(settings) {
  await chrome.storage.sync.set({ settings });
  return { success: true };
}

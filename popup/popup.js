// Twitter GIF Grabber - Popup Script

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadHistory();
  loadDownloads();
  loadSettings();
  initEventListeners();
});

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(targetId).classList.add('active');
    });
  });
}

// State for pinned visibility
let showPinned = true;

async function loadHistory() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_HISTORY' });
  const allHistory = response || [];
  // Filter for copied items only (with URL/shareable link)
  const history = allHistory.filter(item => item.type === 'copied' && item.url);
  const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  const settings = settingsResponse || {};
  const autoPlayGifs = settings.autoPlayGifs === true;
  const historyList = document.getElementById('history-list');
  const clearBtn = document.getElementById('clear-history');
  const pinnedToggle = document.getElementById('pinned-toggle');
  const pinnedCount = document.getElementById('pinned-count');
  const toggleArrow = document.getElementById('toggle-arrow');
  
  if (history.length === 0) {
    historyList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">GIF</span>
        <p>No copied links yet</p>
        <p class="hint">Use "copy link" to get shareable URLs</p>
      </div>
    `;
    clearBtn.style.display = 'none';
    pinnedToggle.style.display = 'none';
    return;
  }
  
  clearBtn.style.display = 'block';
  
  // Sort: pinned first, then by date
  const sortedHistory = [...history].map((item, originalIndex) => ({ ...item, originalIndex }));
  const pinnedItems = sortedHistory.filter(item => item.pinned);
  const unpinnedItems = sortedHistory.filter(item => !item.pinned);
  
  // Show pinned toggle if there are pinned items
  if (pinnedItems.length > 0) {
    pinnedToggle.style.display = 'block';
    pinnedCount.textContent = pinnedItems.length;
    toggleArrow.textContent = showPinned ? '▼' : '▶';
  } else {
    pinnedToggle.style.display = 'none';
  }
  
  // Combine based on showPinned state
  const displayHistory = showPinned ? [...pinnedItems, ...unpinnedItems] : unpinnedItems;
  
  historyList.innerHTML = displayHistory.map((item) => {
    const hasPreview = item.url && item.type === 'copied';
    const shortName = item.filename.length > 18 ? item.filename.slice(0, 15) + '...' : item.filename;
    const isPinned = item.pinned === true;
    
    let previewContent;
    if (hasPreview && autoPlayGifs) {
      previewContent = `<img src="${item.url}" alt="GIF" />`;
    } else if (hasPreview) {
      previewContent = '<span class="preview-placeholder">hover to play</span>';
    } else {
      previewContent = '<span class="preview-placeholder">GIF</span>';
    }
    
    return `
      <div class="history-card ${isPinned ? 'pinned' : ''}" data-index="${item.originalIndex}">
        <button class="history-pin-btn ${isPinned ? 'is-pinned' : ''}" data-index="${item.originalIndex}" title="${isPinned ? 'Unpin' : 'Pin'}"><img src="../icons/pin.svg" alt="pin" /></button>
        <button class="history-delete-btn" data-index="${item.originalIndex}" title="Delete">×</button>
        <div class="history-preview ${hasPreview ? 'has-gif' : 'no-preview'}" ${hasPreview ? `data-gif="${item.url}"` : ''}>
          ${previewContent}
        </div>
        <div class="history-card-info">
          <div class="history-card-name" title="${item.filename}">${shortName}</div>
          <div class="history-card-meta">${formatSize(item.size)} · ${formatDate(item.date)}</div>
          <div class="history-card-actions">
            ${item.url ? `<button class="history-copy-btn" data-url="${item.url}">⎘ copy</button>` : ''}
            <a href="${item.tweetUrl}" target="_blank" class="history-tweet-btn" title="View tweet">↗</a>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Load first frame as static thumbnail, animate on hover (only if autoPlayGifs is off)
  if (!autoPlayGifs) {
    historyList.querySelectorAll('.history-preview.has-gif').forEach(preview => {
      const gifUrl = preview.dataset.gif;
      if (!gifUrl) return;
      
      // Create canvas for static first frame
      const canvas = document.createElement('canvas');
      canvas.className = 'preview-canvas';
      
      // Create img for animated GIF (hidden initially)
      const animatedImg = document.createElement('img');
      animatedImg.className = 'preview-animated';
      animatedImg.alt = 'GIF';
      animatedImg.style.display = 'none';
      
      // Load image to capture first frame
      const loaderImg = new Image();
      loaderImg.crossOrigin = 'anonymous';
      loaderImg.onload = () => {
        canvas.width = loaderImg.width;
        canvas.height = loaderImg.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(loaderImg, 0, 0);
        
        preview.innerHTML = '';
        preview.appendChild(canvas);
        preview.appendChild(animatedImg);
      };
      loaderImg.onerror = () => {
        preview.innerHTML = '<span class="preview-placeholder">GIF</span>';
      };
      loaderImg.src = gifUrl;
      
      // On hover, show animated GIF
      preview.addEventListener('mouseenter', () => {
        const canvas = preview.querySelector('.preview-canvas');
        const animated = preview.querySelector('.preview-animated');
        if (canvas && animated) {
          animated.src = gifUrl; // Load fresh to restart animation
          canvas.style.display = 'none';
          animated.style.display = 'block';
        }
      });
      
      // On leave, show static canvas
      preview.addEventListener('mouseleave', () => {
        const canvas = preview.querySelector('.preview-canvas');
        const animated = preview.querySelector('.preview-animated');
        if (canvas && animated) {
          canvas.style.display = 'block';
          animated.style.display = 'none';
          animated.src = ''; // Stop loading/animating
        }
      });
    });
  }
  
  // Add click handlers for copy buttons
  historyList.querySelectorAll('.history-copy-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const url = btn.dataset.url;
      try {
        await navigator.clipboard.writeText(url);
        const originalText = btn.textContent;
        btn.textContent = '✓ copied';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = originalText;
          btn.classList.remove('copied');
        }, 1500);
      } catch {
        window.open(url, '_blank');
      }
    });
  });
  
  // Add click handlers for delete buttons
  historyList.querySelectorAll('.history-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      await chrome.runtime.sendMessage({ type: 'DELETE_HISTORY_ITEM', index });
      loadHistory(); // Refresh
    });
  });
  
  // Add click handlers for pin buttons
  historyList.querySelectorAll('.history-pin-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      await chrome.runtime.sendMessage({ type: 'TOGGLE_PIN_HISTORY_ITEM', index });
      loadHistory(); // Refresh
    });
  });
}

async function loadDownloads() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_HISTORY' });
  const allHistory = response || [];
  // Filter for downloaded items only (no URL - local downloads)
  const downloads = allHistory.filter(item => item.type === 'downloaded');
  const downloadsList = document.getElementById('downloads-list');
  const clearBtn = document.getElementById('clear-downloads');
  
  if (downloads.length === 0) {
    downloadsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">MP4</span>
        <p>No downloads yet</p>
        <p class="hint">Downloaded files appear here</p>
      </div>
    `;
    clearBtn.style.display = 'none';
    return;
  }
  
  clearBtn.style.display = 'block';
  
  downloadsList.innerHTML = downloads.map((item, index) => {
    const shortName = item.filename.length > 25 ? item.filename.slice(0, 22) + '...' : item.filename;
    const isGif = item.filename.endsWith('.gif');
    const isMp4 = item.filename.endsWith('.mp4');
    const typeLabel = isGif ? 'GIF' : isMp4 ? 'MP4' : 'FILE';
    
    return `
      <div class="download-item" data-index="${index}">
        <div class="download-icon">${typeLabel}</div>
        <div class="download-info">
          <div class="download-name" title="${item.filename}">${shortName}</div>
          <div class="download-meta">${formatSize(item.size)} · ${formatDate(item.date)}</div>
        </div>
        <a href="${item.tweetUrl}" target="_blank" class="download-tweet-btn" title="View tweet">↗</a>
      </div>
    `;
  }).join('');
}

async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  const settings = response || {};
  
  document.getElementById('quality').value = settings.quality || 10;
  document.getElementById('quality-value').textContent = settings.quality || 10;
  document.getElementById('maxWidth').value = settings.maxWidth || 480;
  document.getElementById('fps').value = settings.fps || 15;
  document.getElementById('showNotifications').checked = settings.showNotifications !== false;
  document.getElementById('autoDownload').checked = settings.autoDownload !== false;
  document.getElementById('autoPlayGifs').checked = settings.autoPlayGifs === true;
  document.getElementById('autoUploadOnDownload').checked = settings.autoUploadOnDownload === true;
  document.getElementById('includeMp4').checked = settings.includeMp4 === true;
}

function initEventListeners() {
  // Quality slider
  const qualitySlider = document.getElementById('quality');
  qualitySlider.addEventListener('input', (e) => {
    document.getElementById('quality-value').textContent = e.target.value;
  });
  
  // Save settings
  document.getElementById('save-settings').addEventListener('click', async () => {
    const settings = {
      quality: parseInt(document.getElementById('quality').value),
      maxWidth: parseInt(document.getElementById('maxWidth').value),
      fps: parseInt(document.getElementById('fps').value),
      showNotifications: document.getElementById('showNotifications').checked,
      autoDownload: document.getElementById('autoDownload').checked,
      autoPlayGifs: document.getElementById('autoPlayGifs').checked,
      autoUploadOnDownload: document.getElementById('autoUploadOnDownload').checked,
      includeMp4: document.getElementById('includeMp4').checked
    };
    
    await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', data: settings });
    
    // Show feedback
    const btn = document.getElementById('save-settings');
    const originalText = btn.textContent;
    btn.textContent = 'Saved!';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 1500);
  });
  
  // Clear history (only clears copied items)
  document.getElementById('clear-history').addEventListener('click', async () => {
    if (confirm('Clear all copied links?')) {
      await chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY_TYPE', historyType: 'copied' });
      loadHistory();
    }
  });
  
  // Clear downloads (only clears downloaded items)
  document.getElementById('clear-downloads').addEventListener('click', async () => {
    if (confirm('Clear all downloads?')) {
      await chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY_TYPE', historyType: 'downloaded' });
      loadDownloads();
    }
  });
  
  // Toggle pinned visibility
  document.getElementById('toggle-pinned').addEventListener('click', () => {
    showPinned = !showPinned;
    loadHistory();
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
  
  return date.toLocaleDateString();
}



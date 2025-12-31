// Twitter GIF Grabber - Content Script

(function() {
  'use strict';
  
  const BUTTON_CLASS = 'gif-grabber-btn';
  const MP4_BUTTON_CLASS = 'mp4-grabber-btn';
  const PROCESSED_ATTR = 'data-gif-grabber';
  const MP4_PROCESSED_ATTR = 'data-mp4-grabber';
  
  // Store menu controllers by tweetId
  const menuControllers = new Map();
  const mp4MenuControllers = new Map();
  
  // Observe DOM changes
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        injectButtons();
        injectMp4Buttons();
      }
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Initial injection
  setTimeout(() => {
    injectButtons();
    injectMp4Buttons();
  }, 1000);
  
  // Close menus when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.gif-grabber-container')) {
      document.querySelectorAll('.gif-grabber-menu.visible').forEach(menu => {
        menu.classList.remove('visible');
      });
    }
    if (!e.target.closest('.mp4-grabber-container')) {
      document.querySelectorAll('.mp4-grabber-menu.visible').forEach(menu => {
        menu.classList.remove('visible');
      });
    }
  });
  
  // Listen for status updates
  chrome.runtime.onMessage.addListener((message) => {
    const controller = menuControllers.get(message.tweetId);
    
    if (message.type === 'CONVERSION_STATUS') {
      if (!controller) return;
      
      switch (message.status) {
        case 'done':
          controller.renderSuccess('Downloaded!');
          break;
        case 'error':
          controller.renderError(message.error || 'Error');
          break;
        case 'progress':
          controller.renderProgress(message.progress);
          break;
        case 'downloading':
          controller.renderLoading('downloading...');
          break;
        case 'converting':
          controller.renderLoading('converting...');
          break;
        case 'uploading':
          controller.renderUploadingWithHint();
          break;
      }
    } else if (message.type === 'COPY_TO_CLIPBOARD') {
      // Show link with copy button
      if (controller) {
        controller.renderCopyLink(message.url);
      }
    }
  });
  
  function injectButtons() {
    const selectors = [
      'video[poster*="tweet_video_thumb"]',
      '[data-testid="card.wrapper"] video'
    ];
    
    const videos = document.querySelectorAll(selectors.join(','));
    
    videos.forEach((video) => {
      const article = video.closest('article');
      if (!article || article.hasAttribute(PROCESSED_ATTR)) return;
      
      // Only show GIF button on GIFs (not real videos)
      // GIFs: loop=true, or poster contains "tweet_video_thumb" without "ext_tw_video"
      const isGif = video.loop === true || 
                    (video.poster && video.poster.includes('tweet_video_thumb') && !video.poster.includes('ext_tw_video'));
      
      if (!isGif) {
        // It's a real video - skip, MP4 button will handle it
        article.setAttribute(PROCESSED_ATTR, 'true');
        return;
      }
      
      const actionBar = article.querySelector('[role="group"]');
      if (!actionBar) return;
      
      // Find tweet link - use href property (resolved URL) not attribute
      const allStatusLinks = article.querySelectorAll('a[href*="/status/"]');
      const tweetLink = Array.from(allStatusLinks).find(a => {
        const href = a.href;
        return (href.includes('twitter.com/') || href.includes('x.com/')) && href.includes('/status/');
      });
      if (!tweetLink) return;
      
      const tweetId = tweetLink.href.match(/status\/(\d+)/)?.[1];
      if (!tweetId) return;
      
      const tweetUrl = `https://x.com/i/status/${tweetId}`;
      const source = video.querySelector('source');
      const videoUrl = source?.src || video.src;
      
      article.setAttribute(PROCESSED_ATTR, 'true');
      
      const container = createInterface(tweetId, tweetUrl, videoUrl);
      actionBar.appendChild(container);
    });
  }
  
  async function resolveVideoUrl(tweetId, initialUrl) {
    if (initialUrl && !initialUrl.includes('blob:')) return initialUrl;
    
    try {
      const response = await fetch(`https://api.fxtwitter.com/status/${tweetId}`);
      const data = await response.json();
      
      if (data.tweet?.media?.videos?.[0]?.url) {
        return data.tweet.media.videos[0].url;
      }
      
      if (data.tweet?.media?.all) {
        const media = data.tweet.media.all.find(m => m.type === 'gif' || m.type === 'video');
        if (media) return media.url;
      }
    } catch {
      // Silent fail - will return null
    }
    return null;
  }

  function createInterface(tweetId, tweetUrl, videoUrl) {
    const container = document.createElement('div');
    container.className = 'gif-grabber-container';
    
    // Button
    const button = document.createElement('button');
    button.className = BUTTON_CLASS;
    button.setAttribute('data-tweet-id', tweetId);
    button.innerHTML = `<span class="gif-text">GIF</span>`;
    button.title = 'GIF Options';
    
    // Menu
    const menu = document.createElement('div');
    menu.className = 'gif-grabber-menu';
    
    function renderMainMenu() {
      stopFakeUpload();
      menu.innerHTML = `
        <div class="gif-grabber-item" data-nav="download">download</div>
        <div class="gif-grabber-item" data-nav="copy">copy link</div>
      `;
    }
    
    function renderSubMenu(mode) {
      menu.innerHTML = `
        <div class="gif-grabber-item gif-grabber-back" data-nav="back">‹ back</div>
        <div class="gif-grabber-item" data-action="${mode}-mp4">mp4</div>
        <div class="gif-grabber-item" data-action="${mode}-gif">gif</div>
      `;
    }
    
    let fakeUploadInterval = null;
    
    function stopFakeUpload() {
      if (fakeUploadInterval) {
        clearInterval(fakeUploadInterval);
        fakeUploadInterval = null;
      }
    }
    
    function renderFakeUpload() {
      stopFakeUpload(); // Clear any existing interval first
      let fakePercent = 0;
      const height = 3;
      
      const updateBar = () => {
        const filled = Math.round((fakePercent / 100) * height);
        const empty = height - filled;
        const bar = '░<br>'.repeat(empty) + '█<br>'.repeat(filled);
        
        menu.innerHTML = `
          <div class="gif-grabber-loading">
            <div class="gif-grabber-vbar">${bar.slice(0, -4)}</div>
            <div>uploading...</div>
          </div>
        `;
        
        // Slow down as we approach 90%
        if (fakePercent < 90) {
          fakePercent += Math.random() * 15 + 5;
          if (fakePercent > 90) fakePercent = 90;
        }
      };
      
      updateBar();
      fakeUploadInterval = setInterval(updateBar, 400);
    }
    
    function renderLoading(label = null, percent = null) {
      stopFakeUpload();
      const height = 3;
      let bar;
      
      if (percent !== null) {
        const filled = Math.round((percent / 100) * height);
        const empty = height - filled;
        bar = '░<br>'.repeat(empty) + '█<br>'.repeat(filled);
      } else {
        bar = '░<br>'.repeat(height);
      }
      
      menu.innerHTML = `
        <div class="gif-grabber-loading">
          <div class="gif-grabber-vbar ${percent === null ? 'gif-grabber-vbar-anim' : ''}">${bar.slice(0, -4)}</div>
          ${label ? `<div>${label}</div>` : ''}
        </div>
      `;
    }
    
    function renderProgress(percent) {
      renderLoading('converting...', percent);
    }
    
    function renderClipboardError() {
      menu.innerHTML = `
        <div class="gif-grabber-clipboard-hint">
          <span class="gif-grabber-x">✗</span>
          <div>
            <div>Clipboard blocked</div>
            <div class="gif-grabber-hint-sub">Click the icon in address bar →</div>
          </div>
        </div>
      `;
      setTimeout(() => {
        menu.classList.remove('visible');
        renderMainMenu();
      }, 3000);
    }
    
    function renderUploadingWithHint() {
      renderFakeUpload();
    }
    
    function renderClipboardPrompt() {
      const height = 5;
      const bar = '░<br>'.repeat(height);
      menu.innerHTML = `
        <div class="gif-grabber-loading">
          <div class="gif-grabber-vbar gif-grabber-vbar-anim">${bar.slice(0, -4)}</div>
          <div>
            <div>waiting for permission...</div>
            <div class="gif-grabber-hint-sub">click "Allow" in address bar →</div>
          </div>
        </div>
      `;
    }
    
    function renderCopyLink(url) {
      stopFakeUpload();
      const truncated = url.length > 25 ? url.slice(0, 22) + '...' : url;
      menu.innerHTML = `
        <div class="gif-grabber-copy-link">
          <span class="gif-grabber-link-text">${truncated}</span>
          <button class="gif-grabber-copy-btn" title="Copy">⎘</button>
        </div>
      `;
      
      // Add click handler for the whole area
      const container = menu.querySelector('.gif-grabber-copy-link');
      container.onclick = async () => {
        try {
          await navigator.clipboard.writeText(url);
          renderSuccess('Copied!');
        } catch (err) {
          // Fallback: show input for manual copy
          menu.innerHTML = `
            <div class="gif-grabber-copy-fallback">
              <input class="gif-grabber-link-input" value="${url}" readonly />
              <div class="gif-grabber-hint-sub">select & Ctrl+C</div>
            </div>
          `;
          const input = menu.querySelector('.gif-grabber-link-input');
          input.focus();
          input.select();
        }
      };
    }
    
    function renderSuccess(message) {
      stopFakeUpload();
      menu.innerHTML = `
        <div class="gif-grabber-success">
          <span class="gif-grabber-check">✓</span>
          <span>${message}</span>
        </div>
      `;
      setTimeout(() => {
        menu.classList.remove('visible');
        renderMainMenu();
      }, 1500);
    }
    
    function renderError(message) {
      stopFakeUpload();
      menu.innerHTML = `
        <div class="gif-grabber-error">
          <span class="gif-grabber-x">✗</span>
          <span>${message || 'Error'}</span>
        </div>
      `;
      setTimeout(() => {
        menu.classList.remove('visible');
        renderMainMenu();
      }, 1500);
    }
    
    renderMainMenu();
    
    // Store controller for this tweet
    menuControllers.set(tweetId, {
      renderSuccess,
      renderError,
      renderLoading,
      renderProgress,
      renderClipboardError,
      renderClipboardPrompt,
      renderUploadingWithHint,
      renderCopyLink,
      renderMainMenu
    });
    
    // Events
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (button.classList.contains('loading')) return;
      
      // Close other menus
      document.querySelectorAll('.gif-grabber-menu.visible').forEach(m => {
        if (m !== menu) m.classList.remove('visible');
      });
      
      menu.classList.toggle('visible');
    });
    
    menu.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      // Handle navigation
      const nav = e.target.dataset.nav;
      if (nav === 'download') {
        renderSubMenu('download');
        return;
      } else if (nav === 'copy') {
        renderSubMenu('copy');
        return;
      } else if (nav === 'back') {
        renderMainMenu();
        return;
      }
      
      // Handle actions
      const action = e.target.dataset.action;
      if (!action) return;
      
      renderLoading();
      
      const finalUrl = await resolveVideoUrl(tweetId, videoUrl);
      
      if (!finalUrl) {
        renderError('Failed to get URL');
        return;
      }
      
      if (action === 'download-mp4') {
        // Download MP4 directly
        chrome.runtime.sendMessage({
          type: 'DOWNLOAD_MP4',
          data: { videoUrl: finalUrl, tweetId, tweetUrl }
        });
        renderSuccess('Downloading...');
      } else if (action === 'download-gif') {
        // Convert and download GIF
        chrome.runtime.sendMessage({
          type: 'CONVERT_GIF',
          data: { tweetUrl, videoUrl: finalUrl, tweetId }
        });
        // Status updates will come via message listener
      } else if (action === 'copy-mp4') {
        // Track MP4 copy in history (if setting enabled)
        chrome.runtime.sendMessage({
          type: 'COPY_MP4',
          data: { videoUrl: finalUrl, tweetId, tweetUrl }
        });
        // Show link with copy button
        renderCopyLink(finalUrl);
      } else if (action === 'copy-gif') {
        // Convert to GIF, upload, then copy link
        chrome.runtime.sendMessage({
          type: 'CONVERT_AND_COPY',
          data: { tweetUrl, videoUrl: finalUrl, tweetId }
        });
        // Status updates will come via message listener
      }
    });
    
    container.appendChild(button);
    container.appendChild(menu);
    return container;
  }
  
  function injectMp4Buttons() {
    // Broader selectors to catch all videos
    const selectors = [
      'video[poster*="tweet_video_thumb"]',
      'video[poster*="ext_tw_video_thumb"]',
      'video[poster*="amplify_video_thumb"]',
      '[data-testid="card.wrapper"] video',
      '[data-testid="videoPlayer"] video',
      '[data-testid="videoComponent"] video',
      'article video'
    ];
    
    const videos = document.querySelectorAll(selectors.join(','));
    
    videos.forEach((video) => {
      const article = video.closest('article');
      if (!article || article.hasAttribute(MP4_PROCESSED_ATTR)) return;
      
      // Detect if it's a GIF (not a real video)
      // GIFs on Twitter: loop=true, no audio, autoplay, poster contains "tweet_video_thumb"
      const isGif = video.loop === true || 
                    (video.poster && video.poster.includes('tweet_video_thumb') && !video.poster.includes('ext_tw_video'));
      
      if (isGif) {
        // Skip GIFs - only show MP4 button on real videos
        article.setAttribute(MP4_PROCESSED_ATTR, 'true');
        return;
      }
      
      const actionBar = article.querySelector('[role="group"]');
      if (!actionBar) return;
      
      // Find tweet link
      const allStatusLinks = article.querySelectorAll('a[href*="/status/"]');
      const tweetLink = Array.from(allStatusLinks).find(a => {
        const href = a.href;
        return (href.includes('twitter.com/') || href.includes('x.com/')) && href.includes('/status/');
      });
      if (!tweetLink) return;
      
      const tweetId = tweetLink.href.match(/status\/(\d+)/)?.[1];
      if (!tweetId) return;
      
      const tweetUrl = `https://x.com/i/status/${tweetId}`;
      const source = video.querySelector('source');
      const videoUrl = source?.src || video.src;
      
      article.setAttribute(MP4_PROCESSED_ATTR, 'true');
      
      const mp4Container = createMp4Interface(tweetId, tweetUrl, videoUrl);
      actionBar.appendChild(mp4Container);
    });
  }
  
  function createMp4Interface(tweetId, tweetUrl, videoUrl) {
    const container = document.createElement('div');
    container.className = 'mp4-grabber-container';
    
    // Button
    const button = document.createElement('button');
    button.className = MP4_BUTTON_CLASS;
    button.innerHTML = `<span class="mp4-text">MP4</span>`;
    button.title = 'MP4 Options';
    
    // Menu
    const menu = document.createElement('div');
    menu.className = 'mp4-grabber-menu';
    
    function renderMainMenu() {
      menu.innerHTML = `
        <div class="mp4-grabber-item" data-action="download">download mp4</div>
        <div class="mp4-grabber-item" data-action="copy">copy mp4 link</div>
      `;
    }
    
    function renderLoading(label = 'loading...') {
      menu.innerHTML = `
        <div class="mp4-grabber-loading">
          <span class="mp4-grabber-spinner"></span>
          <span>${label}</span>
        </div>
      `;
    }
    
    function renderCopyLink(url) {
      const truncated = url.length > 30 ? url.slice(0, 27) + '...' : url;
      menu.innerHTML = `
        <div class="mp4-grabber-copy-link">
          <span class="mp4-grabber-link-text">${truncated}</span>
          <button class="mp4-grabber-copy-btn" title="Copy">⎘</button>
        </div>
      `;
      
      const copyArea = menu.querySelector('.mp4-grabber-copy-link');
      copyArea.onclick = async () => {
        try {
          await navigator.clipboard.writeText(url);
          renderSuccess('Copied!');
        } catch {
          // Fallback
          menu.innerHTML = `
            <div class="mp4-grabber-copy-fallback">
              <input class="mp4-grabber-link-input" value="${url}" readonly />
            </div>
          `;
          const input = menu.querySelector('.mp4-grabber-link-input');
          input.focus();
          input.select();
        }
      };
    }
    
    function renderSuccess(message) {
      menu.innerHTML = `
        <div class="mp4-grabber-success">
          <span class="mp4-grabber-check">✓</span>
          <span>${message}</span>
        </div>
      `;
      setTimeout(() => {
        menu.classList.remove('visible');
        renderMainMenu();
      }, 1500);
    }
    
    function renderError(message) {
      menu.innerHTML = `
        <div class="mp4-grabber-error">
          <span class="mp4-grabber-x">✗</span>
          <span>${message || 'Error'}</span>
        </div>
      `;
      setTimeout(() => {
        menu.classList.remove('visible');
        renderMainMenu();
      }, 1500);
    }
    
    renderMainMenu();
    
    // Store controller
    mp4MenuControllers.set(`mp4-${tweetId}`, {
      renderSuccess,
      renderError,
      renderLoading,
      renderCopyLink,
      renderMainMenu
    });
    
    // Events
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Close other menus
      document.querySelectorAll('.mp4-grabber-menu.visible').forEach(m => {
        if (m !== menu) m.classList.remove('visible');
      });
      document.querySelectorAll('.gif-grabber-menu.visible').forEach(m => {
        m.classList.remove('visible');
      });
      
      menu.classList.toggle('visible');
    });
    
    menu.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      const action = e.target.dataset.action;
      if (!action) return;
      
      renderLoading();
      
      const finalUrl = await resolveVideoUrl(tweetId, videoUrl);
      
      if (!finalUrl) {
        renderError('Failed to get URL');
        return;
      }
      
      if (action === 'download') {
        chrome.runtime.sendMessage({
          type: 'DOWNLOAD_MP4',
          data: { videoUrl: finalUrl, tweetId, tweetUrl }
        });
        renderSuccess('Downloading...');
      } else if (action === 'copy') {
        // Track MP4 copy in history (if setting enabled)
        chrome.runtime.sendMessage({
          type: 'COPY_MP4',
          data: { videoUrl: finalUrl, tweetId, tweetUrl }
        });
        renderCopyLink(finalUrl);
      }
    });
    
    container.appendChild(button);
    container.appendChild(menu);
    return container;
  }
})();

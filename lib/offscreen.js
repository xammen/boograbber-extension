// Offscreen document for video to GIF conversion

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OFFSCREEN_CONVERT') {
    const videoBlob = base64ToBlob(message.videoBase64, message.videoType || 'video/mp4');
    const tweetId = message.tweetId;
    
    const onProgress = (progress) => {
      chrome.runtime.sendMessage({
        type: 'GIF_PROGRESS',
        tweetId,
        progress: Math.round(progress * 100)
      });
    };
    
    convertVideoToGif(videoBlob, message.settings, onProgress)
      .then(async gifBlob => {
        const gifBase64 = await blobToBase64(gifBlob);
        sendResponse({ gifBase64 });
      })
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

// Helper: Base64 to Blob
function base64ToBlob(base64, type) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type });
}

// Helper: Blob to Base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function convertVideoToGif(videoBlob, settings = {}, onProgress = null) {
  const {
    quality = 10,
    maxWidth = 480,
    fps = 15
  } = settings;
  
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    video.src = URL.createObjectURL(videoBlob);
    
    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      
      // Scale
      let scale = 1;
      if (maxWidth > 0 && width > maxWidth) {
        scale = maxWidth / width;
      }
      
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      
      const isShortGif = duration < 1;
      const targetFps = isShortGif ? 50 : fps;
      const framesPerLoop = Math.max(Math.round(duration * targetFps), 3);
      const loops = isShortGif ? Math.ceil(30 / framesPerLoop) : 1;
      const totalFrames = framesPerLoop * loops;
      const frameDelay = Math.max(Math.round((duration * 1000) / framesPerLoop), 10);
      
      // Initialize GIF encoder
      const gif = new GIF({
        workers: 4,
        quality: quality,
        width: canvas.width,
        height: canvas.height,
        workerScript: chrome.runtime.getURL('lib/gif.worker.js')
      });
      
      gif.on('finished', (blob) => {
        URL.revokeObjectURL(video.src);
        resolve(blob);
      });
      
      if (onProgress) {
        gif.on('progress', onProgress);
      }
      
      // Capture frames by seeking
      const seekAndCapture = (time) => {
        return new Promise((res) => {
          const handler = () => {
            video.removeEventListener('seeked', handler);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            res();
          };
          video.addEventListener('seeked', handler);
          video.currentTime = Math.min(time, duration - 0.001);
        });
      };
      
      try {
        for (let i = 0; i < totalFrames; i++) {
          const frameIndex = i % framesPerLoop;
          const time = (frameIndex / framesPerLoop) * duration;
          await seekAndCapture(time);
          gif.addFrame(ctx, { copy: true, delay: frameDelay });
        }
        
        gif.render();
      } catch (error) {
        reject(error);
      }
    };
    
    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };
  });
}

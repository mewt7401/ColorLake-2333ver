import { LUTMeta, UploadedImage } from '../types';
import { loadLUT } from '../hooks/useLUTData';
import { LUTCanvasRenderer } from './webglRenderer';

// Detect if running on mobile device
const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// iOS Safari has strict memory limits for canvas
// Maximum safe dimensions to prevent crashes on mobile devices
const MAX_CANVAS_PIXELS = 16777216; // 4096x4096, safe for most iOS devices
const MAX_DIMENSION = 4096;

function showImagePreview(imageUrl: string, filename: string, onClose: () => void) {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.95);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: env(safe-area-inset-top, 1rem) env(safe-area-inset-right, 1rem) env(safe-area-inset-bottom, 1rem) env(safe-area-inset-left, 1rem);
    gap: 1.5rem;
    animation: fadeIn 0.2s ease-out;
  `;
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  // Create instruction text
  const instruction = document.createElement('div');
  instruction.style.cssText = `
    color: white;
    font-size: 1.1rem;
    text-align: center;
    padding: 1.25rem 1.5rem;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-radius: 12px;
    max-width: 90%;
    animation: slideUp 0.3s ease-out;
  `;
  
  // Detect if on mobile device
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  instruction.innerHTML = isMobile
    ? `
      <div style="font-size: 1.3rem; margin-bottom: 0.5rem;">📱</div>
      <strong style="font-size: 1.1rem;">长按图片保存</strong><br>
      <small style="opacity: 0.8; font-size: 0.9rem;">或点击下方按钮分享/下载</small>
    `
    : `
      <div style="font-size: 1.3rem; margin-bottom: 0.5rem;">💾</div>
      <strong style="font-size: 1.1rem;">点击下载按钮保存</strong><br>
      <small style="opacity: 0.8; font-size: 0.9rem;">或右键图片另存为</small>
    `;
  
  // Create image
  const img = document.createElement('img');
  img.src = imageUrl;
  img.style.cssText = `
    max-width: 90%;
    max-height: 60vh;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    animation: slideUp 0.4s ease-out;
    user-select: none;
    -webkit-user-select: none;
  `;
  
  // Enable context menu for iOS long-press save
  img.oncontextmenu = (e) => {
    // Allow default behavior on iOS (long-press to save)
    return true;
  };
  
  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 0.75rem;
    flex-direction: column;
    width: 100%;
    max-width: 400px;
    animation: slideUp 0.5s ease-out;
  `;
  
  // Check if Web Share API is available
  const hasShareAPI = typeof navigator.share === 'function';
  const canShare = hasShareAPI || isMobile; // Show share button on mobile even if API detection fails
  
  console.log('Share API check:', {
    hasShareAPI,
    isMobile,
    userAgent: navigator.userAgent,
    canShare
  });
  
  // Create download button - primary button for PC
  const downloadBtn = document.createElement('button');
  downloadBtn.textContent = '💾 下载';
  
  // On PC, download is the primary action; on mobile, it's secondary
  if (isMobile) {
    downloadBtn.style.cssText = `
      flex: 1;
      padding: 0.875rem 1.5rem;
      background: rgba(0, 123, 255, 0.8);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 0.95rem;
      cursor: pointer;
      font-weight: 600;
      transition: transform 0.1s, background 0.2s;
      -webkit-tap-highlight-color: transparent;
    `;
  } else {
    downloadBtn.style.cssText = `
      width: 100%;
      padding: 1rem 1.5rem;
      background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 1rem;
      cursor: pointer;
      font-weight: 600;
      transition: transform 0.1s, opacity 0.2s;
      -webkit-tap-highlight-color: transparent;
    `;
  }
  
  downloadBtn.onclick = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = filename;
    a.click();
  };
  downloadBtn.ontouchstart = () => {
    downloadBtn.style.transform = 'scale(0.95)';
  };
  downloadBtn.ontouchend = () => {
    downloadBtn.style.transform = 'scale(1)';
  };
  
  // On PC, add download button first; on mobile, add share button first
  if (!isMobile) {
    buttonContainer.appendChild(downloadBtn);
  }
  
  // Create share button (for mobile with Web Share API)
  if (canShare) {
    const shareBtn = document.createElement('button');
    shareBtn.textContent = '📤 分享/保存到相册';
    shareBtn.style.cssText = `
      width: 100%;
      padding: 1rem 1.5rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 1rem;
      cursor: pointer;
      font-weight: 600;
      transition: transform 0.1s, opacity 0.2s;
      -webkit-tap-highlight-color: transparent;
    `;
    shareBtn.onclick = async () => {
      try {
        if (!navigator.share) {
          throw new Error('Web Share API not supported');
        }
        // Re-create blob from image URL to share
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], filename, { type: 'image/jpeg' });
        
        console.log('Attempting to share:', { filename, fileSize: blob.size });
        await navigator.share({ files: [file], title: filename });
        console.log('Share successful');
      } catch (err: any) {
        console.log('Share error:', err.name, err.message);
        if (err.name !== 'AbortError') {
          // If share fails, show helpful message
          alert('系统分享功能暂不可用\n\n请尝试：\n1. 长按图片选择"存储图像"\n2. 点击"下载"按钮');
        }
      }
    };
    shareBtn.ontouchstart = () => {
      shareBtn.style.transform = 'scale(0.97)';
    };
    shareBtn.ontouchend = () => {
      shareBtn.style.transform = 'scale(1)';
    };
    
    if (isMobile) {
      buttonContainer.appendChild(shareBtn);
    }
  }
  
  // Secondary buttons row
  const secondaryRow = document.createElement('div');
  secondaryRow.style.cssText = `
    display: flex;
    gap: 0.75rem;
  `;
  
  // On mobile, add download button to secondary row
  if (isMobile) {
    secondaryRow.appendChild(downloadBtn);
  }
  
  // Create close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '关闭';
  closeBtn.style.cssText = `
    flex: 1;
    padding: 0.875rem 1.5rem;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    font-size: 0.95rem;
    cursor: pointer;
    font-weight: 600;
    transition: transform 0.1s, background 0.2s;
    -webkit-tap-highlight-color: transparent;
  `;
  const handleClose = () => {
    overlay.style.animation = 'fadeIn 0.2s ease-out reverse';
    setTimeout(() => {
      document.body.removeChild(overlay);
      document.head.removeChild(style);
      onClose();
    }, 200);
  };
  closeBtn.onclick = handleClose;
  closeBtn.ontouchstart = () => {
    closeBtn.style.transform = 'scale(0.95)';
  };
  closeBtn.ontouchend = () => {
    closeBtn.style.transform = 'scale(1)';
  };
  
  // On mobile, add both download and close to secondary row
  // On PC, only add close button (download is already primary)
  if (isMobile) {
    secondaryRow.appendChild(downloadBtn);
  }
  secondaryRow.appendChild(closeBtn);
  
  // Only add secondary row if it has content
  if (secondaryRow.children.length > 0) {
    buttonContainer.appendChild(secondaryRow);
  }
  
  overlay.appendChild(instruction);
  overlay.appendChild(img);
  overlay.appendChild(buttonContainer);
  
  // Close on overlay click (but not on image click)
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      handleClose();
    }
  };
  
  document.body.appendChild(overlay);
}

function getSafeDimensions(width: number, height: number): { width: number, height: number, scale: number } {
  // On PC/Desktop, allow full resolution export
  if (!isMobileDevice) {
    return { width, height, scale: 1 };
  }
  
  // On mobile devices, check if dimensions exceed max size
  const totalPixels = width * height;
  
  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION && totalPixels <= MAX_CANVAS_PIXELS) {
    return { width, height, scale: 1 };
  }
  
  // Calculate scale to fit within limits
  const pixelScale = Math.sqrt(MAX_CANVAS_PIXELS / totalPixels);
  const dimensionScale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
  const scale = Math.min(pixelScale, dimensionScale, 1);
  
  return {
    width: Math.floor(width * scale),
    height: Math.floor(height * scale),
    scale
  };
}

export async function exportProcessedImage(image: UploadedImage, lut: LUTMeta) {
  let renderer: LUTCanvasRenderer | null = null;
  
  try {
    // 1. Load LUT Data
    const lutData = await loadLUT(lut);

    // 2. Load Original Image
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = image.originalUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    // 3. Calculate safe dimensions for iOS
    const { width, height, scale } = getSafeDimensions(img.naturalWidth, img.naturalHeight);
    
    // Warn user if we're downscaling
    if (scale < 1) {
      const confirmed = confirm(
        `图片尺寸较大(${img.naturalWidth}x${img.naturalHeight})，为防止崩溃将缩小至${width}x${height}导出。是否继续？`
      );
      if (!confirmed) {
        return;
      }
    }

    // 4. Create Canvas and Renderer
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    renderer = new LUTCanvasRenderer(canvas);

    // 5. Render with scaled image if needed
    if (scale < 1) {
      // Create a scaled-down version first
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) {
        throw new Error('无法创建2D上下文');
      }
      ctx.drawImage(img, 0, 0, width, height);
      renderer.render(tempCanvas, lutData);
    } else {
      renderer.render(img, lutData);
    }

    // 6. Export with iOS-friendly share/save
    const originalName = image.name.replace(/\.[^/.]+$/, "");
    const lutName = lut.name.replace(/\s+/g, '-');
    const filename = `${originalName}-${lutName}.jpg`;
    
    // Check Web Share API support (must check before async operations)
    const hasWebShare = !!(navigator.share);
    const isSecureContext = window.isSecureContext || location.protocol === 'https:';
    
    await new Promise<void>((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          reject(new Error('无法生成图片'));
          return;
        }
        
        try {
          // Try Web Share API if available (works on iOS Safari, Chrome Android)
          if (hasWebShare && isSecureContext) {
            try {
              const file = new File([blob], filename, { type: 'image/jpeg' });
              const shareData: ShareData = { files: [file], title: filename };
              
              // Try to share directly
              await navigator.share(shareData);
              resolve();
              return;
            } catch (shareError: any) {
              // User cancelled (AbortError) or not supported (TypeError)
              if (shareError.name === 'AbortError') {
                resolve(); // User cancelled, treat as success
                return;
              }
              // NotAllowedError, TypeError, etc - fall through to preview
              console.log('Web Share not available or failed:', shareError.name, shareError.message);
            }
          }
          
          // Fallback: Create a modal with the image for long-press save
          const url = URL.createObjectURL(blob);
          showImagePreview(url, filename, () => {
            URL.revokeObjectURL(url);
            resolve();
          });
          
        } catch (err) {
          reject(err);
        }
      }, 'image/jpeg', 0.92);
    });
    
  } catch (error) {
    console.error('导出失败:', error);
    throw error;
  } finally {
    // Ensure cleanup happens
    if (renderer) {
      renderer.dispose();
    }
  }
}

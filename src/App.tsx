import { useEffect, useRef, useState, lazy, Suspense} from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ImageSelector } from './components/ImageSelector';
import { PreviewGrid } from './components/PreviewGrid';
import { EmptyState } from './components/EmptyState';
import { CompareSliderWithZoom } from './components/CompareSliderWithZoom';
import { LUT_LIBRARY } from './data/luts';
import type { LUTMeta, UploadedImage } from './types';
import { imageProcessor } from './utils/imageProcessor';
import { exportProcessedImage } from './utils/exportTools';
import './styles/app.css';


const fallbackId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

// 声明全局类型
declare global {
  interface Window {
    SnowScene?: any;
    toggleSnow?: () => void;
  }
}

export default function App() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [selectedLut, setSelectedLut] = useState<LUTMeta | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const urlsRef = useRef<string[]>([]);
  const [isSnowing, setIsSnowing] = useState(false); // 新增：雪花状态
  const snowRef = useRef<any>(null); // 保存雪花实例

  const activeImage = images.find((item: UploadedImage) => item.id === activeImageId) ?? null;

  useEffect(() => {
    return () => {
      urlsRef.current.forEach((url: string) => URL.revokeObjectURL(url));
      if (snowRef.current) {
        snowRef.current.pause?.();
        snowRef.current.destroy?.();
      }
    };
  }, []);

  // 雪花切换函数
  const toggleSnow = () => {
    // 如果已有雪花实例，关闭它
    if (snowRef.current) {
      snowRef.current.pause?.();
      snowRef.current.destroy?.();
      snowRef.current = null;
      setIsSnowing(false);
      return;
    }

    // 如果 SnowScene 已存在，直接创建
    if (window.SnowScene) {
      snowRef.current = new window.SnowScene({
        numFlakes: 80,
        speed: 0.5,
        wind: true,
        color: '#ffffff',
        size: [3, 12]
      });
      snowRef.current.play();
      setIsSnowing(true);
      return;
    }

    // 动态加载雪花脚本
    const script = document.createElement('script');
    script.src = '/scripts/snowflakes.bundle.min.js';
    script.onload = () => {
      if (window.SnowScene) {
        snowRef.current = new window.SnowScene({
          numFlakes: 80,
          speed: 0.5,
          wind: true,
          color: '#ffffff',
          size: [3, 12]
        });
        snowRef.current.play();
        setIsSnowing(true);
      } else {
        console.error('雪花脚本加载失败');
      }
    };
    
    script.onerror = () => {
      console.error('加载雪花脚本时出错');
      alert('无法加载雪花效果，请检查 scripts/snowflakes.bundle.min.js 文件是否存在');
    };
    
    document.head.appendChild(script);
  };

  // 将 toggleSnow 暴露给全局，供按钮直接调用
  useEffect(() => {
    window.toggleSnow = toggleSnow;
    return () => {
      delete window.toggleSnow;
    };
  }, []);


  const handleUpload = (files: File[]) => {
    if (!files.length) {
      return;
    }
    setIsProcessing(true);
    let pendingCount = files.length;

    files.forEach((file) => {
      const id = fallbackId();
      imageProcessor.process(file, id, (error, result) => {
        pendingCount--;
        if (pendingCount === 0) {
          setIsProcessing(false);
        }

        if (error) {
          console.error(`Failed to process ${file.name}:`, error);
          return;
        }

        if (result) {
          urlsRef.current.push(result.originalUrl);
          if (result.previewUrl !== result.originalUrl) {
            urlsRef.current.push(result.previewUrl);
          }

          setImages((prev) => [...prev, result]);
          setActiveImageId((current) => (current ? current : result.id));
        }
      });
    });
  }

  const handleExport = async () => {
    if (!activeImage || !selectedLut) return;
    setIsProcessing(true);
    try {
      await exportProcessedImage(activeImage, selectedLut);
    } catch (error) {
      console.error('Export failed:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      alert(`导出失败: ${errorMessage}\n\n如果图片过大，请尝试使用较小的图片。`);
    } finally {
      setIsProcessing(false);
    }
  };


  return (
    <div className="app-shell">
		<header>
		  <div>
			<h1>ColorLake</h1>
			<p>一站式 LUT 预览与管理</p>
		  </div>
		  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
			<ImageUploader onFilesAccepted={handleUpload} busy={isProcessing} />
		  </div>
		</header>

      <main>
        <section className="left-panel">
          {!activeImage && <EmptyState message="先上传图片" hint="选择任意一张照片后即可进入对比模式" />}
          {activeImage && !selectedLut && (
            <EmptyState message="选择一个 LUT" hint="在右侧预览矩阵中点击任一效果" />
          )}
          {activeImage && selectedLut && (
            <div className="compare-container">
              <div className="toolbar" style={{marginTop: '-1.25rem', marginLeft: '0.1rem', marginRight: '0.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>效果预览</h2>
				<button 
				  onClick={handleExport} 
				  disabled={isProcessing}
				  style={{
					padding: '0.5rem 1rem',
					backgroundColor: 'rgba(12, 14, 19, 0.9)', // 改为preview card的背景色
					color: 'white',
					border: '1px solid rgba(255, 255, 255, 0.05)', // 改为preview card的边框
					borderRadius: '25px', // 改为preview card的圆角
					cursor: isProcessing ? 'wait' : 'pointer',
					opacity: isProcessing ? 0.7 : 1,
					fontSize: '0.8rem',
					backdropFilter: 'blur(4px)',
					boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
					transition: 'border-color 0.2s ease, transform 0.2s ease, background-color 0.2s ease'
				  }}
				  onMouseEnter={(e) => {
					if (!isProcessing) {
					  e.currentTarget.style.borderColor = 'rgba(108, 178, 255, 0.7)';
					  e.currentTarget.style.transform = 'translateY(-0.5px)';
					  e.currentTarget.style.backgroundColor = '#5a77ff';
					  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
					}
				  }}
				  onMouseLeave={(e) => {
					if (!isProcessing) {
					  e.currentTarget.style.borderColor = '#5a77ff';
					  e.currentTarget.style.transform = 'translateY(0)';
					  e.currentTarget.style.backgroundColor = 'rgba(12, 14, 19, 0.9)';
					  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
					}
				  }}
				>
				  {isProcessing ? '处理中...' : '导出全尺寸照片'}
				</button>
              </div>
              <CompareSliderWithZoom
                imageUrl={activeImage.originalUrl}
                imageWidth={activeImage.originalWidth}
                imageHeight={activeImage.originalHeight}
                lut={selectedLut}
              />
            </div>
          )}
          <ImageSelector items={images} activeId={activeImageId} onSelect={setActiveImageId} />
        </section>

        <section className="right-panel">
          <div className="panel-head">
            <div>
              <h2>预览矩阵</h2>
              <p>共 {LUT_LIBRARY.length} 个 LUT</p>
            </div>
          </div>
          <PreviewGrid
            imageUrl={activeImage?.previewUrl ?? null}
            luts={LUT_LIBRARY}
            selectedId={selectedLut?.id ?? null}
            onSelect={(lut) => setSelectedLut(lut)}
          />
        </section>
      </main>
    </div>
  );
}
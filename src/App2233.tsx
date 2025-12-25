import { useEffect, useRef, useState } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ImageSelector } from './components/ImageSelector';
import { PreviewGrid } from './components/PreviewGrid';
import { EmptyState } from './components/EmptyState';
import { CompareSliderWithZoom } from './components/CompareSliderWithZoom';
import { LUT_LIBRARY } from './data/luts';
import type { LUTMeta, UploadedImage } from './types';
import { imageProcessor } from './utils/imageProcessor';
import { exportProcessedImage } from './utils/exportTools';
import { SnowScene } from 'snowflakesjs';
import './styles/app.css';

const fallbackId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export default function App() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [selectedLut, setSelectedLut] = useState<LUTMeta | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const urlsRef = useRef<string[]>([]);
  const [isSnowing, setIsSnowing] = useState(false);
  const snowSceneRef = useRef<any>(null);

  // 切换雪花效果
  const toggleSnow = () => {
    if (isSnowing) {
      // 停止下雪
      snowSceneRef.current?.pause();
    } else {
      // 开始下雪 - 应用到整个body
      if (!snowSceneRef.current) {
        snowSceneRef.current = new SnowScene(document.body, {
          count: 150, // 雪花数量，适中
          minSize: 1,
          maxSize: 3,
          speed: 0.5,
          opacity: 0.7,
        });
      }
      snowSceneRef.current.play();
    }
    setIsSnowing(!isSnowing);
  };

  const activeImage = images.find((item: UploadedImage) => item.id === activeImageId) ?? null;

  // 清理函数
  useEffect(() => {
    return () => {
      if (snowSceneRef.current) {
        snowSceneRef.current.pause();
        snowSceneRef.current = null;
      }
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
  };

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
        {/* 雪花按钮 - 放在上传按钮旁边 */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            onClick={toggleSnow}
            style={{
              background: 'none',
              border: 'none',
              color: isSnowing ? '#3b82f6' : '#a7b3ce',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.25rem',
              borderRadius: '4px',
              transition: 'all 0.2s',
            }}
            aria-label={isSnowing ? '关闭雪花效果' : '开启雪花效果'}
            title={isSnowing ? '点击关闭雪花' : '点击开启雪花'}
          >
            {isSnowing ? '❄️' : '❅'}
          </button>
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
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isProcessing ? 'wait' : 'pointer',
                    opacity: isProcessing ? 0.7 : 1
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

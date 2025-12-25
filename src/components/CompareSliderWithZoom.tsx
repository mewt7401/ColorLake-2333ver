import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { LUTMeta } from '../types';
import { LUTPreviewCanvas } from './LUTPreviewCanvas';
import { ZoomableImage } from './ZoomableImage';

interface Props {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  lut: LUTMeta;
}

export function CompareSliderWithZoom({ imageUrl, imageWidth, imageHeight, lut }: Props) {
  const [value, setValue] = useState(50);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const rectRef = useRef<DOMRect | null>(null);

  const clampPercent = useCallback((next: number) => Math.min(100, Math.max(0, next)), []);

  const updateFromClientX = useCallback((clientX: number) => {
    const rect = draggingRef.current && rectRef.current 
      ? rectRef.current 
      : stageRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }
    const percent = ((clientX - rect.left) / rect.width) * 100;
    setValue(clampPercent(percent));
  }, [clampPercent]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // 检查是否点击在画中画导航器上，如果是则不处理
    if ((event.target as HTMLElement).closest('.pip-navigator')) {
      return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    draggingRef.current = true;
    
    if (stageRef.current) {
      rectRef.current = stageRef.current.getBoundingClientRect();
      // 如果有pointer capture支持，捕获指针
      try {
        (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      } catch (e) {
        // ignore
      }
    }
    updateFromClientX(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) {
      return;
    }
    event.stopPropagation();
    updateFromClientX(event.clientX);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) {
      return;
    }
    draggingRef.current = false;
    rectRef.current = null;
    try {
      (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    } catch (e) {
      // ignore
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      setValue((prev) => clampPercent(prev - 2));
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      setValue((prev) => clampPercent(prev + 2));
    }
  };

  return (
    <div className="compare-wrapper">
      <ZoomableImage
        imageUrl={imageUrl}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        className="compare-stage"
      >
        <div
          ref={stageRef}
          style={{ width: '100%', height: '100%', position: 'relative' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onPointerCancel={endDrag}
        >
          <img className="reference" src={imageUrl} alt="原图" draggable={false} />
          <div className="graded" style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }}>
            <LUTPreviewCanvas imageUrl={imageUrl} lut={lut} highQuality={true} />
          </div>
          <div
            className="handle"
            style={{ left: `${value}%` }}
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(value)}
            aria-label="对比滑杆"
            onKeyDown={handleKeyDown}
          >
            <span />
          </div>
        </div>
      </ZoomableImage>
    </div>
  );
}

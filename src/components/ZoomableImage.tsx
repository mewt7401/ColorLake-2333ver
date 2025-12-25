import { useCallback, useRef, useState, useEffect } from 'react';
import type { WheelEvent as ReactWheelEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from 'react';

interface Props {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  className?: string;
  children?: React.ReactNode;
}

interface ViewState {
  scale: number;
  translateX: number;
  translateY: number;
}

interface TouchInfo {
  id: number;
  x: number;
  y: number;
}

export function ZoomableImage({ imageUrl, imageWidth, imageHeight, className = '', children }: Props) {
  const [viewState, setViewState] = useState<ViewState>({ scale: 1, translateX: 0, translateY: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startTranslateRef = useRef({ x: 0, y: 0 });
  
  // Touch/Pinch state
  const touchesRef = useRef<TouchInfo[]>([]);
  const lastPinchDistanceRef = useRef(0);
  const lastPinchCenterRef = useRef({ x: 0, y: 0 });

  const aspectStyle = imageWidth > 0 && imageHeight > 0
    ? { aspectRatio: `${imageWidth} / ${imageHeight}` }
    : undefined;

  // 重置视图
  const resetView = useCallback(() => {
    setViewState({ scale: 1, translateX: 0, translateY: 0 });
  }, []);

  // 处理滚轮缩放
  const handleWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    setViewState((prev) => {
      // 缩放因子
      const delta = event.deltaY > 0 ? 0.9 : 1.1;
      let newScale = prev.scale * delta;

      // 限制缩放范围
      newScale = Math.max(1, Math.min(10, newScale));

      if (newScale === 1) {
        return { scale: 1, translateX: 0, translateY: 0 };
      }

      // 计算新的平移量，使鼠标位置保持不变
      const scaleChange = newScale / prev.scale;
      const newTranslateX = mouseX - (mouseX - prev.translateX) * scaleChange;
      const newTranslateY = mouseY - (mouseY - prev.translateY) * scaleChange;

      // 限制平移范围
      const minTranslateX = rect.width * (1 - newScale);
      const minTranslateY = rect.height * (1 - newScale);

      return {
        scale: newScale,
        translateX: Math.max(minTranslateX, Math.min(0, newTranslateX)),
        translateY: Math.max(minTranslateY, Math.min(0, newTranslateY)),
      };
    });
  }, []);

  // 处理双击重置
  const handleDoubleClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    resetView();
  }, [resetView]);

  // 处理拖动开始
  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (viewState.scale <= 1) return;

    event.preventDefault();
    isDraggingRef.current = true;
    startPosRef.current = { x: event.clientX, y: event.clientY };
    startTranslateRef.current = { x: viewState.translateX, y: viewState.translateY };

    if (containerRef.current) {
      containerRef.current.setPointerCapture(event.pointerId);
    }
  }, [viewState.scale, viewState.translateX, viewState.translateY]);

  // 处理拖动中
  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || viewState.scale <= 1) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const deltaX = event.clientX - startPosRef.current.x;
    const deltaY = event.clientY - startPosRef.current.y;

    const minTranslateX = rect.width * (1 - viewState.scale);
    const minTranslateY = rect.height * (1 - viewState.scale);

    setViewState((prev) => ({
      ...prev,
      translateX: Math.max(minTranslateX, Math.min(0, startTranslateRef.current.x + deltaX)),
      translateY: Math.max(minTranslateY, Math.min(0, startTranslateRef.current.y + deltaY)),
    }));
  }, [viewState.scale]);

  // 处理拖动结束
  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    isDraggingRef.current = false;
    try {
      containerRef.current?.releasePointerCapture(event.pointerId);
    } catch (error) {
      // ignore
    }
  }, []);

  // 计算画中画的位置和大小（基于内容坐标）
  const getPIPStyle = useCallback(() => {
    if (!containerRef.current || viewState.scale <= 1) return null;

    const containerRect = containerRef.current.getBoundingClientRect();
    const imgEl = containerRef.current.querySelector('img.reference') as HTMLImageElement | null;
    if (!imgEl) return null;
    const imgRect = imgEl.getBoundingClientRect();

    // visible area of the image (in image coordinates) is the intersection
    // left offset inside the image is container.left - image.left
    const visibleLeftPx = containerRect.left - imgRect.left;
    const visibleTopPx = containerRect.top - imgRect.top;

    // Use image's rendered width/height as the reference
    const imgWidth = imgRect.width;
    const imgHeight = imgRect.height;
    if (imgWidth <= 0 || imgHeight <= 0) return null;

    const visibleWidthPercent = (containerRect.width / imgWidth) * 100;
    const visibleHeightPercent = (containerRect.height / imgHeight) * 100;

    let leftPercent = (visibleLeftPx / imgWidth) * 100;
    let topPercent = (visibleTopPx / imgHeight) * 100;

    // Clamp
    leftPercent = Math.max(0, Math.min(100 - visibleWidthPercent, leftPercent));
    topPercent = Math.max(0, Math.min(100 - visibleHeightPercent, topPercent));

    return {
      left: `${leftPercent}%`,
      top: `${topPercent}%`,
      width: `${visibleWidthPercent}%`,
      height: `${visibleHeightPercent}%`,
    };
  }, [viewState]);

  // 处理画中画的拖动
  const handlePIPPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();

    const navigatorEl = event.currentTarget;
    const viewportEl = navigatorEl.querySelector('.pip-viewport');
    
    if (!navigatorEl || !viewportEl || !containerRef.current) return;

    const pipRect = navigatorEl.getBoundingClientRect();
    const viewportRect = viewportEl.getBoundingClientRect();
    
    // 判断点击的是视口框还是背景
    const isViewportClick = viewportEl.contains(event.target as Node);

    let startOffsetX = 0;
    let startOffsetY = 0;

    if (isViewportClick) {
      // 点击视口框：保持相对位置拖动
      startOffsetX = event.clientX - viewportRect.left;
      startOffsetY = event.clientY - viewportRect.top;
    } else {
      // 点击背景：将视口框中心移动到点击位置
      startOffsetX = viewportRect.width / 2;
      startOffsetY = viewportRect.height / 2;
    }

    // 获取当前图片和容器的尺寸信息
    const imgEl = containerRef.current.querySelector('img.reference') as HTMLImageElement | null;
    if (!imgEl) return;
    const imgRect = imgEl.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // 缓存当前的 scale
    const currentScale = viewState.scale;

    const updatePosition = (clientX: number, clientY: number) => {
      // 计算鼠标在导航器内的相对位置
      const pipMouseX = clientX - pipRect.left;
      const pipMouseY = clientY - pipRect.top;

      // 计算期望的 viewport 左上角位置 (相对于 pipNavigator)
      const desiredViewportLeft = pipMouseX - startOffsetX;
      const desiredViewportTop = pipMouseY - startOffsetY;

      // 转换为百分比
      let desiredLeftPercent = (desiredViewportLeft / pipRect.width) * 100;
      let desiredTopPercent = (desiredViewportTop / pipRect.height) * 100;

      // 计算视口在导航器中的百分比大小
      const visibleWidthPercent = (containerRect.width / imgRect.width) * 100;
      const visibleHeightPercent = (containerRect.height / imgRect.height) * 100;

      // 限制百分比范围
      desiredLeftPercent = Math.max(0, Math.min(100 - visibleWidthPercent, desiredLeftPercent));
      desiredTopPercent = Math.max(0, Math.min(100 - visibleHeightPercent, desiredTopPercent));

      // 将百分比转换为实际图片的平移量
      const newTranslateX = - (desiredLeftPercent / 100) * imgRect.width;
      const newTranslateY = - (desiredTopPercent / 100) * imgRect.height;

      // 限制平移范围
      const minTranslateX = containerRect.width * (1 - currentScale);
      const minTranslateY = containerRect.height * (1 - currentScale);

      setViewState((prev) => ({
        ...prev,
        translateX: Math.max(minTranslateX, Math.min(0, newTranslateX)),
        translateY: Math.max(minTranslateY, Math.min(0, newTranslateY)),
      }));
    };

    // 如果是点击背景，立即更新一次位置
    if (!isViewportClick) {
      updatePosition(event.clientX, event.clientY);
    }

    const handleMove = (e: PointerEvent) => {
      updatePosition(e.clientX, e.clientY);
    };

    const handleUp = (e: PointerEvent) => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      try {
        navigatorEl.releasePointerCapture(e.pointerId);
      } catch (error) {
        // ignore
      }
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    
    try {
      navigatorEl.setPointerCapture(event.pointerId);
    } catch (error) {
      // ignore
    }
  }, [viewState.scale]);

  // 处理触摸开始
  const handleTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const touches: TouchInfo[] = [];
    for (let i = 0; i < event.touches.length; i++) {
      const touch = event.touches[i];
      touches.push({ id: touch.identifier, x: touch.clientX, y: touch.clientY });
    }
    touchesRef.current = touches;

    if (touches.length === 2) {
      // 双指缩放开始
      const dx = touches[1].x - touches[0].x;
      const dy = touches[1].y - touches[0].y;
      lastPinchDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
      lastPinchCenterRef.current = {
        x: (touches[0].x + touches[1].x) / 2,
        y: (touches[0].y + touches[1].y) / 2,
      };
    }
  }, []);

  // 处理触摸移动
  const handleTouchMove = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2 && touchesRef.current.length === 2) {
      event.preventDefault();

      const touches: TouchInfo[] = [];
      for (let i = 0; i < event.touches.length; i++) {
        const touch = event.touches[i];
        touches.push({ id: touch.identifier, x: touch.clientX, y: touch.clientY });
      }

      // 计算当前双指距离和中心点
      const dx = touches[1].x - touches[0].x;
      const dy = touches[1].y - touches[0].y;
      const currentDistance = Math.sqrt(dx * dx + dy * dy);
      const currentCenter = {
        x: (touches[0].x + touches[1].x) / 2,
        y: (touches[0].y + touches[1].y) / 2,
      };

      const container = containerRef.current;
      if (!container || lastPinchDistanceRef.current === 0) return;

      const rect = container.getBoundingClientRect();
      
      // 计算缩放比例
      const scaleChange = currentDistance / lastPinchDistanceRef.current;
      
      setViewState((prev) => {
        let newScale = prev.scale * scaleChange;
        newScale = Math.max(1, Math.min(10, newScale));

        if (newScale === 1) {
          lastPinchDistanceRef.current = currentDistance;
          return { scale: 1, translateX: 0, translateY: 0 };
        }

        // 计算相对于容器的中心点位置
        const centerX = currentCenter.x - rect.left;
        const centerY = currentCenter.y - rect.top;

        // 以缩放中心点为基准调整平移
        const actualScaleChange = newScale / prev.scale;
        const newTranslateX = centerX - (centerX - prev.translateX) * actualScaleChange;
        const newTranslateY = centerY - (centerY - prev.translateY) * actualScaleChange;

        // 限制平移范围
        const minTranslateX = rect.width * (1 - newScale);
        const minTranslateY = rect.height * (1 - newScale);

        lastPinchDistanceRef.current = currentDistance;
        lastPinchCenterRef.current = currentCenter;

        return {
          scale: newScale,
          translateX: Math.max(minTranslateX, Math.min(0, newTranslateX)),
          translateY: Math.max(minTranslateY, Math.min(0, newTranslateY)),
        };
      });

      touchesRef.current = touches;
    }
  }, []);

  // 处理触摸结束
  const handleTouchEnd = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) {
      lastPinchDistanceRef.current = 0;
      touchesRef.current = [];
    }
  }, []);

  const pipStyle = getPIPStyle();

  return (
    <div
      ref={containerRef}
      className={`zoomable-image ${className}`}
      style={{ ...aspectStyle, position: 'relative', overflow: 'hidden', cursor: viewState.scale > 1 ? (isDraggingRef.current ? 'grabbing' : 'grab') : 'default' }}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        className="zoomable-content"
        style={{
          width: '100%',
          height: '100%',
          transform: `translate(${viewState.translateX}px, ${viewState.translateY}px) scale(${viewState.scale})`,
          transformOrigin: '0 0',
          transition: isDraggingRef.current ? 'none' : 'transform 0.1s ease-out',
        }}
      >
        {children}
      </div>

      {/* 画中画导航 */}
      {pipStyle && (
        <div className="pip-navigator" onPointerDown={handlePIPPointerDown}>
          <img src={imageUrl} alt="缩略图" draggable={false} />
          <div
            className="pip-viewport"
            style={pipStyle}
          />
        </div>
      )}
    </div>
  );
}

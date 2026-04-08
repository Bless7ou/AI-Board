import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

interface Props {
  penColor: string;
  penSize: number;
  isEraser: boolean;
}

export interface DrawingCanvasHandle {
  getImageDataURL: () => string;
  clear: () => void;
}

const DrawingCanvas = forwardRef<DrawingCanvasHandle, Props>(
  ({ penColor, penSize, isEraser }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);

    // 캔버스를 컨테이너 크기에 맞게 리사이즈
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const resize = () => {
        const parent = canvas.parentElement;
        if (!parent) return;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(imageData, 0, 0);
      };

      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(canvas.parentElement!);
      return () => observer.disconnect();
    }, []);

    const getPos = (e: MouseEvent | Touch, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clientX = 'clientX' in e ? e.clientX : (e as Touch).clientX;
      const clientY = 'clientY' in e ? e.clientY : (e as Touch).clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const startDraw = useCallback((x: number, y: number) => {
      isDrawing.current = true;
      lastPos.current = { x, y };
    }, []);

    const draw = useCallback((x: number, y: number) => {
      if (!isDrawing.current || !lastPos.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;

      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = isEraser ? '#1a1a2e' : penColor;
      ctx.lineWidth = isEraser ? penSize * 4 : penSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      lastPos.current = { x, y };
    }, [penColor, penSize, isEraser]);

    const stopDraw = useCallback(() => {
      isDrawing.current = false;
      lastPos.current = null;
    }, []);

    // 마우스 이벤트
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const onMouseDown = (e: MouseEvent) => {
        const pos = getPos(e, canvas);
        startDraw(pos.x, pos.y);
      };
      const onMouseMove = (e: MouseEvent) => {
        const pos = getPos(e, canvas);
        draw(pos.x, pos.y);
      };

      canvas.addEventListener('mousedown', onMouseDown);
      canvas.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', stopDraw);
      return () => {
        canvas.removeEventListener('mousedown', onMouseDown);
        canvas.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', stopDraw);
      };
    }, [startDraw, draw, stopDraw]);

    // 터치 이벤트 (iPad)
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const onTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        const touch = e.touches[0];
        const pos = getPos(touch, canvas);
        startDraw(pos.x, pos.y);
      };
      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        const touch = e.touches[0];
        const pos = getPos(touch, canvas);
        draw(pos.x, pos.y);
      };
      const onTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        stopDraw();
      };

      canvas.addEventListener('touchstart', onTouchStart, { passive: false });
      canvas.addEventListener('touchmove', onTouchMove, { passive: false });
      canvas.addEventListener('touchend', onTouchEnd, { passive: false });
      return () => {
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
      };
    }, [startDraw, draw, stopDraw]);

    useImperativeHandle(ref, () => ({
      getImageDataURL: () => {
        const canvas = canvasRef.current;
        if (!canvas) return '';
        return canvas.toDataURL('image/png');
      },
      clear: () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: isEraser ? 'cell' : 'crosshair',
          touchAction: 'none',
        }}
      />
    );
  }
);

DrawingCanvas.displayName = 'DrawingCanvas';
export default DrawingCanvas;

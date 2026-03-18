import { useCallback, useRef, useState, useEffect } from 'react';
import { useLayoutSettings, NavDockMode } from '@/contexts/LayoutSettingsContext';
import { GripVertical } from 'lucide-react';

const EDGE_THRESHOLD = 60;

function detectDockEdge(x: number, y: number, w: number, h: number): NavDockMode {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (y <= EDGE_THRESHOLD) return 'top';
  if (y + h >= vh - EDGE_THRESHOLD) return 'bottom';
  if (x <= EDGE_THRESHOLD) return 'left';
  if (x + w >= vw - EDGE_THRESHOLD) return 'right';
  return 'floating';
}

export default function DockableNavBar({ children }: { children: React.ReactNode }) {
  const { navDockMode, setNavDockMode, navFloatingPosition, setNavFloatingPosition } = useLayoutSettings();
  const [isDragging, setIsDragging] = useState(false);
  const [previewDock, setPreviewDock] = useState<NavDockMode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const tempPosRef = useRef<{ x: number; y: number } | null>(null);
  const [renderPos, setRenderPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return () => { if (cleanupRef.current) cleanupRef.current(); };
  }, []);

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if ('button' in e && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const rect = containerRef.current?.getBoundingClientRect();
    const origX = rect ? rect.left : navFloatingPosition.x;
    const origY = rect ? rect.top : navFloatingPosition.y;
    const elW = rect ? rect.width : 800;
    const elH = rect ? rect.height : 60;

    const startRef = { startX: clientX, startY: clientY, origX, origY, elW, elH };
    setIsDragging(true);
    tempPosRef.current = { x: origX, y: origY };
    setRenderPos({ x: origX, y: origY });

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = 'touches' in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      const dx = cx - startRef.startX;
      const dy = cy - startRef.startY;
      const newX = Math.max(0, Math.min(window.innerWidth - 100, startRef.origX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 40, startRef.origY + dy));
      tempPosRef.current = { x: newX, y: newY };
      setRenderPos({ x: newX, y: newY });
      setPreviewDock(detectDockEdge(newX, newY, startRef.elW, startRef.elH));
    };

    const onEnd = () => {
      const finalPos = tempPosRef.current;
      if (finalPos) {
        const newDock = detectDockEdge(finalPos.x, finalPos.y, startRef.elW, startRef.elH);
        setNavDockMode(newDock);
        if (newDock === 'floating') {
          setNavFloatingPosition(finalPos);
        }
      }
      tempPosRef.current = null;
      setRenderPos(null);
      setIsDragging(false);
      setPreviewDock(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      cleanupRef.current = null;
    };

    cleanupRef.current = onEnd;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  }, [navFloatingPosition, setNavDockMode, setNavFloatingPosition]);

  if (isMobile) {
    return <>{children}</>;
  }

  const currentDock = previewDock || navDockMode;

  if (isDragging && renderPos) {
    return (
      <>
        {currentDock === 'top' && <div className="fixed top-0 left-0 right-0 h-1.5 bg-primary/60 z-[9999] animate-pulse rounded-b" />}
        {currentDock === 'bottom' && <div className="fixed bottom-0 left-0 right-0 h-1.5 bg-primary/60 z-[9999] animate-pulse rounded-t" />}
        {currentDock === 'left' && <div className="fixed top-0 left-0 bottom-0 w-1.5 bg-primary/60 z-[9999] animate-pulse rounded-r" />}
        {currentDock === 'right' && <div className="fixed top-0 right-0 bottom-0 w-1.5 bg-primary/60 z-[9999] animate-pulse rounded-l" />}
        <div
          ref={containerRef}
          className="fixed z-[9998] opacity-70 pointer-events-none scale-95 transition-transform"
          style={{ left: renderPos.x, top: renderPos.y }}
        >
          {children}
        </div>
      </>
    );
  }

  if (navDockMode === 'top') {
    return (
      <div ref={containerRef} className="relative group/dock">
        <div
          className="absolute top-1 left-1/2 -translate-x-1/2 z-[51] cursor-grab active:cursor-grabbing opacity-0 group-hover/dock:opacity-60 hover:!opacity-100 transition-opacity hidden md:flex"
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
          title="Arrastar barra de navegação"
        >
          <GripVertical className="w-4 h-4 rotate-90" />
        </div>
        {children}
      </div>
    );
  }

  if (navDockMode === 'bottom') {
    return (
      <div ref={containerRef} className="fixed bottom-0 left-0 right-0 z-50 group/dock">
        <div
          className="absolute top-1 left-1/2 -translate-x-1/2 z-[51] cursor-grab active:cursor-grabbing opacity-0 group-hover/dock:opacity-60 hover:!opacity-100 transition-opacity hidden md:flex"
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
          title="Arrastar barra de navegação"
        >
          <GripVertical className="w-4 h-4 rotate-90" />
        </div>
        {children}
      </div>
    );
  }

  if (navDockMode === 'left' || navDockMode === 'right') {
    const side = navDockMode === 'left' ? 'left-0 border-r' : 'right-0 border-l';
    return (
      <div
        ref={containerRef}
        className={`fixed top-0 ${side} bottom-0 z-50 w-16 bg-slate-900/95 backdrop-blur-md border-slate-700 flex flex-col items-center py-2 gap-1 overflow-y-auto overflow-x-hidden group/dock`}
      >
        <div
          className="cursor-grab active:cursor-grabbing opacity-30 group-hover/dock:opacity-80 transition-opacity mb-1 hidden md:flex"
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
          title="Arrastar barra de navegação"
        >
          <GripVertical className="w-4 h-4 text-white" />
        </div>
        {children}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed z-50 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl group/dock"
      style={{ left: navFloatingPosition.x, top: navFloatingPosition.y, maxWidth: 'calc(100vw - 40px)' }}
    >
      <div
        className="flex items-center justify-center cursor-grab active:cursor-grabbing opacity-30 group-hover/dock:opacity-80 transition-opacity py-1 hidden md:flex"
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        title="Arrastar barra de navegação"
      >
        <GripVertical className="w-4 h-4 text-white rotate-90" />
      </div>
      <div className="p-1">
        {children}
      </div>
    </div>
  );
}

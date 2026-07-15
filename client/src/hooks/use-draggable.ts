import { useState, useRef, useCallback, useEffect } from 'react';

export type DockEdge = 'top' | 'left' | 'right' | 'bottom' | 'none';

interface UseDraggableOptions {
  storageKey: string;
  defaultPosition?: { x: number; y: number };
  edgeThreshold?: number;
  constrainToWindow?: boolean;
  elementSize?: { w: number; h: number };
}

interface UseDraggableReturn {
  position: { x: number; y: number };
  setPosition: (pos: { x: number; y: number }) => void;
  onDragStart: (e: React.MouseEvent | React.TouchEvent) => void;
  nearEdge: DockEdge;
  isDragging: boolean;
}

export function useDraggable({
  storageKey,
  defaultPosition = { x: -1, y: -1 },
  edgeThreshold = 60,
  constrainToWindow = true,
  elementSize = { w: 0, h: 0 },
}: UseDraggableOptions): UseDraggableReturn {
  const [position, setPositionState] = useState<{ x: number; y: number }>(() => {
    try {
      const stored = localStorage.getItem(`draggable_${storageKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          if (parsed.x >= 0 && parsed.y >= 0 && typeof window !== 'undefined') {
            return {
              x: Math.min(Math.max(0, parsed.x), Math.max(0, window.innerWidth - 120)),
              y: Math.min(Math.max(0, parsed.y), Math.max(0, window.innerHeight - 80)),
            };
          }
          return parsed;
        }
      }
    } catch {}
    return defaultPosition;
  });

  const [nearEdge, setNearEdge] = useState<DockEdge>('none');
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  const setPosition = useCallback((pos: { x: number; y: number }) => {
    setPositionState(pos);
    try {
      localStorage.setItem(`draggable_${storageKey}`, JSON.stringify(pos));
    } catch {}
  }, [storageKey]);

  const detectEdge = useCallback((x: number, y: number): DockEdge => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (y <= edgeThreshold) return 'top';
    if (y + elementSize.h >= vh - edgeThreshold) return 'bottom';
    if (x <= edgeThreshold) return 'left';
    if (x + elementSize.w >= vw - edgeThreshold) return 'right';
    return 'none';
  }, [edgeThreshold, elementSize]);

  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if ('button' in e && e.button !== 0) return;
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    let origX = position.x;
    let origY = position.y;
    if (origX < 0 || origY < 0) {
      const target = (e.target as HTMLElement).closest('[data-draggable-root]') || (e.target as HTMLElement).parentElement;
      if (target) {
        const rect = target.getBoundingClientRect();
        origX = rect.left;
        origY = rect.top;
      }
    }
    dragRef.current = { startX: clientX, startY: clientY, origX, origY };
    setIsDragging(true);

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = 'touches' in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      const dx = cx - dragRef.current.startX;
      const dy = cy - dragRef.current.startY;
      let newX = dragRef.current.origX + dx;
      let newY = dragRef.current.origY + dy;

      if (constrainToWindow) {
        newX = Math.max(0, Math.min(window.innerWidth - (elementSize.w || 50), newX));
        newY = Math.max(0, Math.min(window.innerHeight - (elementSize.h || 50), newY));
      }

      setPositionState({ x: newX, y: newY });
      setNearEdge(detectEdge(newX, newY));
    };

    const onEnd = () => {
      if (dragRef.current) {
        const finalPos = { x: position.x, y: position.y };
        setPositionState(prev => {
          try {
            localStorage.setItem(`draggable_${storageKey}`, JSON.stringify(prev));
          } catch {}
          return prev;
        });
      }
      dragRef.current = null;
      setIsDragging(false);
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
  }, [position, constrainToWindow, elementSize, detectEdge, storageKey]);

  return { position, setPosition, onDragStart, nearEdge, isDragging };
}

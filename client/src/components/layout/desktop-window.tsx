import { useCallback, useRef, useState, useEffect, type ReactNode } from "react";
import { useDesktopWindowManager, type DesktopWindow as DWin } from "@/contexts/DesktopWindowManagerContext";
import { Minus, Square, X, Maximize2 } from "lucide-react";


interface DesktopWindowProps {
  windowData: DWin;
  children: ReactNode;
}

export default function DesktopWindowComponent({ windowData, children }: DesktopWindowProps) {
  const {
    closeWindow,
    minimizeWindow,
    focusWindow,
    toggleMaximize,
    updateWindowPosition,
    updateWindowSize,
    activeWindowId,
  } = useDesktopWindowManager();

  const dragRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [localPos, setLocalPos] = useState(windowData.position);
  const [resizing, setResizing] = useState(false);
  const [localSize, setLocalSize] = useState(windowData.size);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    if (!isDragging) setLocalPos(windowData.position);
  }, [windowData.position, isDragging]);

  useEffect(() => {
    if (!resizing) setLocalSize(windowData.size);
  }, [windowData.size, resizing]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      focusWindow(windowData.id);
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - localPos.x,
        y: e.clientY - localPos.y,
      };
    },
    [focusWindow, windowData.id, localPos]
  );

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => {
      const newX = Math.max(0, e.clientX - dragOffset.current.x);
      const newY = Math.max(0, e.clientY - dragOffset.current.y);
      setLocalPos({ x: newX, y: newY });
    };
    const handleUp = () => {
      setIsDragging(false);
      setLocalPos(prev => {
        updateWindowPosition(windowData.id, prev);
        return prev;
      });
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDragging, windowData.id, updateWindowPosition]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      focusWindow(windowData.id);
      setResizing(true);
      resizeStart.current = { x: e.clientX, y: e.clientY, w: localSize.w, h: localSize.h };
    },
    [focusWindow, windowData.id, localSize]
  );

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e: MouseEvent) => {
      const newW = Math.max(320, resizeStart.current.w + (e.clientX - resizeStart.current.x));
      const newH = Math.max(200, resizeStart.current.h + (e.clientY - resizeStart.current.y));
      setLocalSize({ w: newW, h: newH });
    };
    const handleUp = () => {
      setResizing(false);
      setLocalSize(prev => {
        updateWindowSize(windowData.id, prev);
        return prev;
      });
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [resizing, windowData.id, updateWindowSize]);

  if (windowData.state !== "open") return null;

  const isActive = activeWindowId === windowData.id;
  const isMax = !!windowData.maximized;
  const Icon = windowData.icon;

  const style: React.CSSProperties = isMax
    ? { position: "fixed", top: 0, left: 0, width: "100vw", height: "calc(100vh - 56px)", zIndex: windowData.zIndex }
    : {
        position: "fixed",
        left: localPos.x,
        top: localPos.y,
        width: localSize.w,
        height: localSize.h,
        zIndex: windowData.zIndex,
      };

  return (
    <div
      ref={windowRef}
      className={`flex flex-col rounded-xl overflow-hidden shadow-2xl border transition-shadow duration-150 ${
        isActive
          ? "border-sky-500/40 shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
          : "border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
      }`}
      style={{
        ...style,
        background: "var(--card-glass, hsla(222,47%,11%,0.82))",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
      }}
      onMouseDown={() => {
        if (!isActive) focusWindow(windowData.id);
      }}
    >
      <div
        ref={dragRef}
        className="flex items-center h-9 px-3 shrink-0 select-none border-b border-white/10"
        style={{
          background: isActive
            ? "var(--titlebar-active, rgba(15, 23, 42, 0.92))"
            : "var(--titlebar-inactive, rgba(15, 23, 42, 0.78))",
          cursor: isDragging ? "grabbing" : "grab",
        }}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => toggleMaximize(windowData.id)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--role-icon-color, #38bdf8)" }} />
          <span className="text-xs font-medium text-white/80 truncate">{windowData.title}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-white/80 hover:text-white"
            onClick={(e) => { e.stopPropagation(); minimizeWindow(windowData.id); }}
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-white/80 hover:text-white"
            onClick={(e) => { e.stopPropagation(); toggleMaximize(windowData.id); }}
          >
            {isMax ? <Square className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
          <button
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-500/20 transition-colors text-white/80 hover:text-red-400"
            onClick={(e) => { e.stopPropagation(); closeWindow(windowData.id); }}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative" style={{ minHeight: 0 }}>
        {children}
      </div>

      {!isMax && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
          onMouseDown={handleResizeStart}
          style={{
            background: "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.15) 50%)",
            borderRadius: "0 0 12px 0",
          }}
        />
      )}
    </div>
  );
}

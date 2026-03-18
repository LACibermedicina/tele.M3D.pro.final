import { GripVertical, Minus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PanelWindowControlsProps {
  onMinimize?: () => void;
  onClose?: () => void;
  showGrip?: boolean;
  showMinimize?: boolean;
  showClose?: boolean;
  className?: string;
}

export default function PanelWindowControls({
  onMinimize,
  onClose,
  showGrip = true,
  showMinimize = true,
  showClose = true,
  className = "",
}: PanelWindowControlsProps) {
  return (
    <div
      className={`flex items-center gap-0.5 ${className}`}
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
    >
      {showGrip && (
        <div
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground transition-colors"
          onMouseDown={e => { e.stopPropagation(); }}
          onTouchStart={e => { e.stopPropagation(); }}
          style={{ pointerEvents: "none" }}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      )}
      {showMinimize && onMinimize && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-sm hover:bg-muted"
          onClick={onMinimize}
        >
          <Minus className="h-3 w-3" />
        </Button>
      )}
      {showClose && onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-sm hover:bg-destructive/20 hover:text-destructive"
          onClick={onClose}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

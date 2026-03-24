import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GripVertical, Minus, X, RotateCcw } from "lucide-react";

interface PanelWindowControlsProps {
  onDragStart?: (e: React.MouseEvent | React.TouchEvent) => void;
  onMinimize?: () => void;
  onClose?: () => void;
  onReset?: () => void;
  showGrip?: boolean;
  showMinimize?: boolean;
  showClose?: boolean;
  showReset?: boolean;
  size?: "sm" | "md";
  alwaysVisible?: boolean;
  dark?: boolean;
}

export default function PanelWindowControls({
  onDragStart,
  onMinimize,
  onClose,
  onReset,
  showGrip = true,
  showMinimize = true,
  showClose = true,
  showReset = false,
  size = "sm",
  alwaysVisible = false,
  dark = false,
}: PanelWindowControlsProps) {
  const iconSize = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";
  const btnSize = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  const gripSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  const btnClass = dark
    ? `${btnSize} text-white/70 hover:text-white hover:bg-white/10`
    : btnSize;
  const closeClass = dark
    ? `${btnSize} text-white/70 hover:text-white hover:bg-white/10`
    : `${btnSize} hover:bg-destructive/20 hover:text-destructive`;
  const gripClass = dark
    ? "cursor-grab active:cursor-grabbing p-0.5 text-white/50 hover:text-white"
    : "cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground";

  return (
    <div className={`flex items-center gap-0.5 ${alwaysVisible ? "" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
      {showGrip && onDragStart && (
        <div
          className={gripClass}
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
        >
          <GripVertical className={gripSize} />
        </div>
      )}
      <div className="flex items-center gap-0.5" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
        {showReset && onReset && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={btnClass} onClick={onReset}>
                <RotateCcw className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Resetar posição</p></TooltipContent>
          </Tooltip>
        )}
        {showMinimize && onMinimize && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={btnClass} onClick={onMinimize}>
                <Minus className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Minimizar</p></TooltipContent>
          </Tooltip>
        )}
        {showClose && onClose && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={closeClass} onClick={onClose}>
                <X className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Fechar</p></TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

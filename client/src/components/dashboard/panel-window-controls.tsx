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
}: PanelWindowControlsProps) {
  const iconSize = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";
  const btnSize = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  const gripSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <div className={`flex items-center gap-0.5 ${alwaysVisible ? "" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
      {showGrip && onDragStart && (
        <div
          className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground"
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
              <Button variant="ghost" size="icon" className={btnSize} onClick={onReset}>
                <RotateCcw className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Resetar posição</p></TooltipContent>
          </Tooltip>
        )}
        {showMinimize && onMinimize && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={btnSize} onClick={onMinimize}>
                <Minus className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Minimizar</p></TooltipContent>
          </Tooltip>
        )}
        {showClose && onClose && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={`${btnSize} hover:bg-destructive/20 hover:text-destructive`} onClick={onClose}>
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

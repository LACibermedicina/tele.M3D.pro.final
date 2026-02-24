import { getTriageConfig, type TriageLevel } from "@/lib/triage";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TriageBadgeProps {
  level: string;
  showLabel?: boolean;
  showDot?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

export function TriageBadge({ level, showLabel = true, showDot = true, size = 'md', showTooltip = true, className = '' }: TriageBadgeProps) {
  const config = getTriageConfig(level);

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  const badge = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor: `${config.color}15`,
        borderColor: `${config.color}40`,
        color: config.color,
      }}
    >
      {showDot && (
        <span
          className={`${dotSizes[size]} rounded-full flex-shrink-0`}
          style={{ backgroundColor: config.color }}
        />
      )}
      {showLabel && config.label}
    </span>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">{config.label}</p>
            <p className="text-xs">{config.description}</p>
            <p className="text-xs text-muted-foreground">{config.maxWaitTime}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function TriageColorBar({ level, className = '' }: { level: string; className?: string }) {
  const config = getTriageConfig(level);
  return (
    <div
      className={`w-1 rounded-full ${className}`}
      style={{ backgroundColor: config.color }}
      title={config.label}
    />
  );
}

export function TriageDot({ level, size = 'md' }: { level: string; size?: 'sm' | 'md' | 'lg' }) {
  const config = getTriageConfig(level);
  const sizes = { sm: 'w-2 h-2', md: 'w-3 h-3', lg: 'w-4 h-4' };
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <span
            className={`${sizes[size]} rounded-full inline-block`}
            style={{ backgroundColor: config.color }}
          />
        </TooltipTrigger>
        <TooltipContent side="top">
          <span className="text-xs font-medium">{config.label}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

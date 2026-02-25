import { useMemo } from 'react';

interface FormattedTextProps {
  content: string;
  className?: string;
}

type ParsedNode =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'italic'; content: string }
  | { type: 'bolditalic'; content: string }
  | { type: 'code'; content: string }
  | { type: 'heading'; level: number; content: string }
  | { type: 'listitem'; content: string }
  | { type: 'numlistitem'; content: string; number: string }
  | { type: 'divider' }
  | { type: 'newline' };

function parseInline(text: string): ParsedNode[] {
  const nodes: ParsedNode[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    if (match[2]) {
      nodes.push({ type: 'bolditalic', content: match[2] });
    } else if (match[3]) {
      nodes.push({ type: 'bold', content: match[3] });
    } else if (match[4]) {
      nodes.push({ type: 'italic', content: match[4] });
    } else if (match[5]) {
      nodes.push({ type: 'code', content: match[5] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return nodes;
}

function renderInline(nodes: ParsedNode[], keyPrefix: string) {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (node.type) {
      case 'bolditalic':
        return <strong key={key} className="font-bold italic text-foreground">{node.content}</strong>;
      case 'bold':
        return <strong key={key} className="font-semibold text-foreground">{node.content}</strong>;
      case 'italic':
        return <em key={key} className="italic text-muted-foreground">{node.content}</em>;
      case 'code':
        return <code key={key} className="px-1.5 py-0.5 rounded bg-muted font-mono text-[0.85em] text-primary">{node.content}</code>;
      case 'text':
        return <span key={key}>{node.content}</span>;
      default:
        return null;
    }
  });
}

function parseContent(text: string): ParsedNode[][] {
  const lines = text.split('\n');
  const result: ParsedNode[][] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '' || trimmed === '---' || trimmed === '***' || trimmed === '___') {
      if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
        result.push([{ type: 'divider' }]);
      } else {
        result.push([{ type: 'newline' }]);
      }
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      result.push([{ type: 'heading', level: headingMatch[1].length, content: headingMatch[2].replace(/\*\*/g, '').replace(/\*/g, '') }]);
      continue;
    }

    const listMatch = trimmed.match(/^[-•]\s+(.+)$/);
    if (listMatch) {
      result.push([{ type: 'listitem', content: listMatch[1] }]);
      continue;
    }

    const numListMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (numListMatch) {
      result.push([{ type: 'numlistitem', number: numListMatch[1], content: numListMatch[2] }]);
      continue;
    }

    result.push(parseInline(trimmed));
  }

  return result;
}

export function FormattedText({ content, className = '' }: FormattedTextProps) {
  const parsed = useMemo(() => parseContent(content || ''), [content]);

  if (!content) return null;

  return (
    <div className={`space-y-1 ${className}`}>
      {parsed.map((lineNodes, lineIdx) => {
        if (lineNodes.length === 1) {
          const node = lineNodes[0];

          if (node.type === 'newline') {
            return <div key={lineIdx} className="h-1" />;
          }

          if (node.type === 'divider') {
            return <hr key={lineIdx} className="border-border my-2" />;
          }

          if (node.type === 'heading') {
            const sizes: Record<number, string> = {
              1: 'text-base font-bold text-primary',
              2: 'text-sm font-bold text-primary',
              3: 'text-sm font-semibold text-foreground',
              4: 'text-xs font-semibold text-foreground uppercase tracking-wide',
            };
            return (
              <p key={lineIdx} className={`${sizes[node.level] || sizes[3]} mt-2 mb-0.5`}>
                {node.content}
              </p>
            );
          }

          if (node.type === 'listitem') {
            return (
              <div key={lineIdx} className="flex items-start gap-2 pl-1">
                <span className="text-primary mt-1.5 text-[8px]">●</span>
                <span className="flex-1">{renderInline(parseInline(node.content), `li-${lineIdx}`)}</span>
              </div>
            );
          }

          if (node.type === 'numlistitem') {
            return (
              <div key={lineIdx} className="flex items-start gap-2 pl-1">
                <span className="text-primary font-semibold text-xs min-w-[1.2em] text-right">{node.number}.</span>
                <span className="flex-1">{renderInline(parseInline(node.content), `nli-${lineIdx}`)}</span>
              </div>
            );
          }
        }

        return (
          <p key={lineIdx}>
            {renderInline(lineNodes, `p-${lineIdx}`)}
          </p>
        );
      })}
    </div>
  );
}

export default FormattedText;

import { Children, isValidElement, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Citation } from '../lib/api';

export function safeUrl(value: string): string | undefined {
  try {
    const url = new URL(value, 'https://mobinshaterian.com');
    if (!['https:', 'http:'].includes(url.protocol)) return undefined;
    if (value.startsWith('/') && !value.startsWith('//')) return url.href;
    return url.href;
  } catch { return undefined; }
}

function plainText(node: ReactNode): string { return Children.toArray(node).map(item => typeof item === 'string' ? item : isValidElement<{ children?: ReactNode }>(item) ? plainText(item.props.children) : '').join(''); }

function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  return <div className="code-block"><button type="button" aria-label="Copy code block" onClick={async () => { await navigator.clipboard.writeText(plainText(children)); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }}>{copied ? 'Copied' : 'Copy code'}</button><pre>{children}</pre></div>;
}

export function Markdown({ content, citations = [] }: { content: string; citations?: Citation[] }) {
  const lookup = new Map(citations.map(c => [c.citation_id, c]));
  const linked = content.replace(/\[([A-Za-z]\w*)\]/g, (full, id: string) => {
    const citation = lookup.get(id);
    const href = citation && safeUrl(citation.url);
    return href ? `[${id}](${href})` : full;
  });
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    a: ({ href, children }) => {
      const safe = href && safeUrl(href);
      return safe ? <a href={safe} target="_blank" rel="noopener noreferrer">{children}<span className="sr-only"> (opens in new tab)</span></a> : <span>{children}</span>;
    },
    code: ({ children, className }) => <code className={className}>{children}</code>,
    pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
    table: ({ children }) => <div className="table-scroll"><table>{children}</table></div>,
  }}>{linked}</ReactMarkdown></div>;
}

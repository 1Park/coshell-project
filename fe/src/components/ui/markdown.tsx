import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('text-sm leading-relaxed break-words', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mt-3 mb-1.5 text-base font-bold first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-3 mb-1.5 text-[15px] font-bold first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-2.5 mb-1 text-sm font-bold first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-sky-600 underline hover:text-sky-500 dark:text-sky-400">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="bg-muted rounded px-1 py-px font-mono text-[12px]">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="bg-muted my-2 overflow-x-auto rounded-lg p-2.5 font-mono text-[12px]">{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-border my-2 border-l-2 pl-3 text-muted-foreground">{children}</blockquote>
          ),
          hr: () => <hr className="border-border my-3" />,
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-border border-b px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-border border-b px-2 py-1">{children}</td>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

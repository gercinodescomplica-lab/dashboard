'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Render de Markdown das respostas do assistente — títulos, listas, tabelas,
// código, links. Estilo enxuto que acompanha o tema do widget.
export function Markdown({ children, lightActive }: { children: string; lightActive: boolean }) {
    const code = lightActive ? 'bg-zinc-100 text-zinc-800' : 'bg-zinc-800 text-zinc-100';
    const border = lightActive ? 'border-zinc-200' : 'border-zinc-700';
    const link = lightActive ? 'text-indigo-600' : 'text-indigo-400';

    return (
        <div className="text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    p: ({ children }) => <p className="my-2 whitespace-pre-wrap break-words">{children}</p>,
                    h1: ({ children }) => <h1 className="mt-3 mb-1.5 text-base font-bold">{children}</h1>,
                    h2: ({ children }) => <h2 className="mt-3 mb-1.5 text-[15px] font-bold">{children}</h2>,
                    h3: ({ children }) => <h3 className="mt-2.5 mb-1 text-sm font-bold">{children}</h3>,
                    ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="marker:text-current/50">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    a: ({ children, href }) => (
                        <a href={href} target="_blank" rel="noreferrer" className={`${link} underline underline-offset-2`}>{children}</a>
                    ),
                    code: ({ className, children }) => {
                        const isBlock = /language-/.test(className ?? '');
                        if (isBlock) {
                            return <code className={`block overflow-x-auto rounded-md p-2.5 font-mono text-[12px] ${code}`}>{children}</code>;
                        }
                        return <code className={`rounded px-1 py-0.5 font-mono text-[12px] ${code}`}>{children}</code>;
                    },
                    pre: ({ children }) => <pre className="my-2">{children}</pre>,
                    blockquote: ({ children }) => (
                        <blockquote className={`my-2 border-l-2 pl-3 italic ${border} ${lightActive ? 'text-zinc-600' : 'text-zinc-400'}`}>{children}</blockquote>
                    ),
                    table: ({ children }) => (
                        <div className="my-2 overflow-x-auto">
                            <table className={`w-full border-collapse text-[12px] ${border} [&_td]:border [&_th]:border [&_td]:px-2 [&_td]:py-1 [&_th]:px-2 [&_th]:py-1 [&_td]:${border} [&_th]:${border}`}>
                                {children}
                            </table>
                        </div>
                    ),
                    th: ({ children }) => <th className={`border ${border} px-2 py-1 text-left font-semibold`}>{children}</th>,
                    td: ({ children }) => <td className={`border ${border} px-2 py-1`}>{children}</td>,
                    hr: () => <hr className={`my-3 ${border}`} />,
                }}
            >
                {children}
            </ReactMarkdown>
        </div>
    );
}

import type { ReactNode } from 'react';

export function Notice({ tom, children }: { tom: 'sucesso' | 'perigo'; children: ReactNode }) {
    const cor = tom === 'sucesso' ? 'border-green-500/50 bg-green-500/10 text-green-400' : 'border-red-500/50 bg-red-500/10 text-red-400';
    return <div role={tom === 'perigo' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-2 text-sm ${cor}`}>{children}</div>;
}

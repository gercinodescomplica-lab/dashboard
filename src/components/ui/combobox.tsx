'use client';
import { useId, useState } from 'react';
import { Input } from './input';

interface Props<T> {
    rotulo: string;
    placeholder: string;
    valor: string;
    aoMudarTexto: (t: string) => void;
    opcoes: T[];
    chave: (t: T) => string;
    rotuloDe: (t: T) => string;
    aoEscolher: (t: T) => void;
    vazio: string;
    desabilitado?: boolean;
}

export function Combobox<T>({ rotulo, placeholder, valor, aoMudarTexto, opcoes, chave, rotuloDe, aoEscolher, vazio, desabilitado }: Props<T>) {
    const id = useId();
    const [aberto, setAberto] = useState(false);
    return (
        <div className="relative">
            <label htmlFor={id} className="mb-1 block text-xs font-medium text-zinc-400">{rotulo}</label>
            <Input
                id={id}
                role="combobox"
                aria-expanded={aberto}
                aria-controls={`${id}-lista`}
                value={valor}
                placeholder={placeholder}
                disabled={desabilitado}
                onFocus={() => setAberto(true)}
                onBlur={() => setTimeout(() => setAberto(false), 150)}
                onChange={(e) => { aoMudarTexto(e.target.value); setAberto(true); }}
            />
            {aberto && (
                <ul id={`${id}-lista`} role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-lg">
                    {opcoes.length === 0 && <li className="px-3 py-1.5 text-sm text-zinc-500">{vazio}</li>}
                    {opcoes.map((o) => (
                        <li
                            key={chave(o)}
                            role="option"
                            aria-selected={false}
                            className="cursor-pointer px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { aoEscolher(o); setAberto(false); }}
                        >
                            {rotuloDe(o)}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

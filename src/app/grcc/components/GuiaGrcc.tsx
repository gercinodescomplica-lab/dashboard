'use client';

import { useState } from 'react';
import { useClaro } from '../tema';
import { HelpCircle, ListChecks, MessageSquarePlus, RefreshCw, X } from 'lucide-react';

const CHAVE = 'grcc-guia-oculto';

const PASSOS = [
    {
        Icone: ListChecks,
        titulo: 'Complete os cadastros',
        texto: 'Clique em "Completar cadastro": abre um lead por vez, com o que falta destacado em amarelo. Pode pular e voltar depois.',
    },
    {
        Icone: MessageSquarePlus,
        titulo: 'Registre cada andamento',
        texto: 'A cada contato com o cliente, abra o lead e escreva em "Registrar andamento". Os anteriores ficam guardados com data.',
    },
    {
        Icone: RefreshCw,
        titulo: 'O dashboard atualiza sozinho',
        texto: 'O que você salva aqui vira o pipeline da Débora e aparece na aba Cidades em até 15 segundos. Não há mais planilha.',
    },
];

function lerOculto(): boolean {
    try {
        return localStorage.getItem(CHAVE) === '1';
    } catch {
        return false;
    }
}

export function GuiaGrcc() {
    const claro = useClaro();
    const [oculto, setOculto] = useState(lerOculto);

    const alternar = (valor: boolean) => {
        setOculto(valor);
        try {
            if (valor) localStorage.setItem(CHAVE, '1');
            else localStorage.removeItem(CHAVE);
        } catch {
            // Sem armazenamento (aba anônima): o guia só volta a aparecer na próxima visita.
        }
    };

    if (oculto) {
        return (
            <button type="button" onClick={() => alternar(false)} className={`self-start text-xs text-zinc-500 ${claro ? 'hover:text-zinc-900' : 'hover:text-zinc-200'} inline-flex items-center gap-1`}>
                <HelpCircle className="w-3.5 h-3.5" /> Como funciona esta página?
            </button>
        );
    }

    return (
        <section aria-label="Como funciona" className="relative grid grid-cols-1 md:grid-cols-3 gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 pr-10">
            {PASSOS.map(({ Icone, titulo, texto }, i) => (
                <div key={titulo} className="flex gap-3">
                    <span className={`shrink-0 w-7 h-7 rounded-full bg-indigo-500/20 ${claro ? 'text-indigo-700' : 'text-indigo-300'} text-xs font-bold flex items-center justify-center`}>{i + 1}</span>
                    <div>
                        <p className={`text-sm font-semibold ${claro ? 'text-zinc-900' : 'text-zinc-100'} flex items-center gap-1.5`}>
                            <Icone className={`w-4 h-4 ${claro ? 'text-indigo-700' : 'text-indigo-300'}`} /> {titulo}
                        </p>
                        <p className={`text-xs ${claro ? 'text-zinc-600' : 'text-zinc-400'} mt-0.5`}>{texto}</p>
                    </div>
                </div>
            ))}
            <button type="button" onClick={() => alternar(true)} aria-label="Fechar guia" title="Entendi" className={`absolute top-3 right-3 p-1 text-zinc-500 ${claro ? 'hover:text-zinc-900' : 'hover:text-zinc-200'}`}>
                <X className="w-4 h-4" />
            </button>
        </section>
    );
}

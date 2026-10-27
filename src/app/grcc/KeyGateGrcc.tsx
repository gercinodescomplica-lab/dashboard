'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { verificarChaveGrcc } from './actions';
import { useClaro } from './tema';

const STORAGE_KEY = 'GRCC_ACCESS';
const ChaveContext = createContext<{ chave: string; sair: () => void } | null>(null);

export function useChaveGrcc() {
    const ctx = useContext(ChaveContext);
    if (!ctx) throw new Error('useChaveGrcc fora do KeyGateGrcc');
    return ctx;
}

export function KeyGateGrcc({ children }: { children: React.ReactNode }) {
    const [chave, setChave] = useState<string | null>(null);
    const [verificando, setVerificando] = useState(true);
    const [digitada, setDigitada] = useState('');
    const [erro, setErro] = useState(false);
    const claro = useClaro();

    useEffect(() => {
        let salva: string | null = null;
        try {
            salva = localStorage.getItem(STORAGE_KEY);
        } catch {
            salva = null;
        }
        const conferida = salva;
        (conferida ? verificarChaveGrcc(conferida) : Promise.resolve(false)).then((ok) => {
            if (ok) setChave(conferida);
            else {
                if (conferida) {
                    try {
                        localStorage.removeItem(STORAGE_KEY);
                    } catch {}
                }
            }
            setVerificando(false);
        });
    }, []);

    const entrar = async (e: React.FormEvent) => {
        e.preventDefault();
        setErro(false);
        setVerificando(true);
        const ok = await verificarChaveGrcc(digitada);
        if (ok) {
            try {
                localStorage.setItem(STORAGE_KEY, digitada.trim());
            } catch {}
            setChave(digitada.trim());
        } else setErro(true);
        setVerificando(false);
    };

    const sair = () => {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {}
        setChave(null);
        setDigitada('');
    };

    if (chave) return <ChaveContext.Provider value={{ chave, sair }}>{children}</ChaveContext.Provider>;

    if (verificando) {
        return (
            <div className={`min-h-screen ${claro ? 'bg-white' : 'bg-zinc-950'} flex items-center justify-center`}>
                <div className="w-6 h-6 border-2 border-indigo-500 rounded-full animate-spin border-t-transparent" />
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${claro ? 'bg-white' : 'bg-zinc-950'} flex items-center justify-center p-4`}>
            <form onSubmit={entrar} className={`w-full max-w-sm ${claro ? 'bg-white' : 'bg-zinc-900'} border ${claro ? 'border-zinc-200' : 'border-zinc-800'} rounded-2xl p-6 flex flex-col gap-4`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 ${claro ? 'text-indigo-600' : 'text-indigo-400'}`}>
                        <Lock className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-lg font-bold ${claro ? 'text-zinc-900' : 'text-zinc-100'}`}>GRCC · Leads</h1>
                        <p className="text-xs text-zinc-500">Área de edição da GRCC. Informe a chave de acesso.</p>
                    </div>
                </div>
                <Input
                    type="password"
                    value={digitada}
                    onChange={(e) => setDigitada(e.target.value)}
                    placeholder="Chave GRCC"
                    autoFocus
                    className={`${claro ? 'bg-white' : 'bg-zinc-950'} ${claro ? 'border-zinc-200' : 'border-zinc-800'}`}
                />
                {erro && <p className={`text-sm ${claro ? 'text-red-600' : 'text-red-400'}`}>Chave incorreta.</p>}
                <Button type="submit" className={claro ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : undefined} disabled={!digitada.trim()}>Entrar</Button>
                <Link href="/" className={`text-xs text-center text-zinc-500 ${claro ? 'hover:text-zinc-700' : 'hover:text-zinc-300'}`}>Voltar ao dashboard</Link>
            </form>
        </div>
    );
}

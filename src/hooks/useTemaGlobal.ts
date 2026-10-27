'use client';

import { useCallback, useEffect, useState } from 'react';
import { applyBodyTheme, THEME_STORAGE_KEY } from '@/lib/themeSync';

type Tema = 'dark' | 'light';

/** Tema global do sistema (mesma chave do dashboard/contratos). Começa no escuro até ler o valor salvo. */
export function useTemaGlobal() {
    const [tema, setTema] = useState<Tema>('dark');

    useEffect(() => {
        let salvo: Tema = 'dark';
        try {
            const v = localStorage.getItem(THEME_STORAGE_KEY);
            if (v === 'light' || v === 'dark') salvo = v;
        } catch {
            // localStorage indisponível — mantém o escuro.
        }
        setTema(salvo);
        applyBodyTheme(salvo);
    }, []);

    const alternar = useCallback(() => {
        setTema((t) => {
            const next: Tema = t === 'dark' ? 'light' : 'dark';
            try {
                localStorage.setItem(THEME_STORAGE_KEY, next);
            } catch {
                // segue só em memória
            }
            applyBodyTheme(next);
            return next;
        });
    }, []);

    return { tema, claro: tema === 'light', alternar };
}

'use client';

import { useEffect, useRef } from 'react';
import { versaoGrcc } from '@/services/grcc.service';

/**
 * "Ao vivo" sem WebSocket: consulta `grcc_versao` (consulta mínima) a cada `intervaloMs`
 * com a aba visível, na hora ao voltar o foco, e instantaneamente quando a /grcc avisa pelo
 * BroadcastChannel('grcc') neste mesmo navegador. Chama `onMudou` só quando a versão muda.
 */
export function useVersaoGrcc(onMudou: () => void, intervaloMs = 15000): void {
    const callback = useRef(onMudou);
    useEffect(() => {
        callback.current = onMudou;
    });

    useEffect(() => {
        let ultima: number | null = null;
        let vivo = true;
        let emCurso = false;

        const checar = async () => {
            if (emCurso || document.hidden) return;
            emCurso = true;
            try {
                const v = await versaoGrcc();
                if (!vivo) return;
                if (ultima !== null && v !== ultima) callback.current();
                ultima = v;
            } catch {
                // silencioso: tenta no próximo ciclo
            } finally {
                emCurso = false;
            }
        };

        checar();
        const timer = setInterval(checar, intervaloMs);
        const aoVoltar = () => {
            if (!document.hidden) checar();
        };
        document.addEventListener('visibilitychange', aoVoltar);
        window.addEventListener('focus', aoVoltar);

        let canal: BroadcastChannel | null = null;
        try {
            canal = new BroadcastChannel('grcc');
            canal.onmessage = () => {
                ultima = null; // a próxima leitura vira referência nova
                callback.current();
                checar();
            };
        } catch {
            canal = null;
        }

        return () => {
            vivo = false;
            clearInterval(timer);
            document.removeEventListener('visibilitychange', aoVoltar);
            window.removeEventListener('focus', aoVoltar);
            canal?.close();
        };
    }, [intervaloMs]);
}

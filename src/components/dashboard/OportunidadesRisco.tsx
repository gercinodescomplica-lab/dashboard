'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { getOportunidadesRisco } from '@/services/oportunidades.service';
import type { OportunidadesRiscoData } from '@/types/oportunidades';
import { OportunidadesRiscoPainel } from './OportunidadesRiscoPainel';

/**
 * Container do bloco "Oportunidades em Risco" do fim da tela inicial do gerente:
 * busca os dados e delega a apresentação para `OportunidadesRiscoPainel`.
 *
 * A busca vem da server action `getOportunidadesRisco` — hoje ela lê o levantamento
 * estático (`src/data/oportunidades-consolidado.json`); quando a origem virar tabela
 * no banco, nada aqui precisa mudar.
 */

interface OportunidadesRiscoProps {
    /** Código da gerência (`manager.role`): "KAM1", "GRC1", "GRCC"... — chave do levantamento. */
    managerRole: string;
    /** Fallback de casamento quando `role` vier vazio (`manager.id`: "kam1-malde"). */
    managerId?: string;
    lightActive?: boolean;
}

export function OportunidadesRisco({ managerRole, managerId, lightActive = false }: OportunidadesRiscoProps) {
    const [data, setData] = useState<OportunidadesRiscoData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const T = {
        emptyText: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        emptyBorder: lightActive ? 'border-zinc-300' : 'border-zinc-800',
    };

    useEffect(() => {
        let cancelado = false;
        setIsLoading(true);
        setError(null);
        setData(null);

        getOportunidadesRisco(managerRole, managerId)
            .then((resultado) => {
                if (!cancelado) setData(resultado);
            })
            .catch((err) => {
                console.error('[OportunidadesRisco] Falha ao carregar levantamento:', err);
                if (!cancelado) setError('Não foi possível carregar as oportunidades em risco.');
            })
            .finally(() => {
                if (!cancelado) setIsLoading(false);
            });

        return () => {
            cancelado = true;
        };
    }, [managerRole, managerId]);

    if (isLoading) {
        return (
            <div className={`flex items-center justify-center py-16 ${T.emptyText}`}>
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando oportunidades em risco...
            </div>
        );
    }

    if (error) {
        return (
            <div className={`flex flex-col items-center justify-center py-16 border border-dashed rounded-2xl gap-3 ${T.emptyText} ${T.emptyBorder}`}>
                <AlertTriangle className="w-8 h-8 opacity-40" />
                <p className="text-base font-medium">{error}</p>
            </div>
        );
    }

    return <OportunidadesRiscoPainel data={data} lightActive={lightActive} />;
}

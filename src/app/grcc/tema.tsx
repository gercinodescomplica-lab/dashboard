'use client';

import { createContext, useContext } from 'react';
import { useTemaGlobal } from '@/hooks/useTemaGlobal';

type TemaGrcc = { claro: boolean; alternar: () => void };

const TemaContext = createContext<TemaGrcc>({ claro: false, alternar: () => {} });

/** Tema da área GRCC: um único estado (o global do sistema) para a página e os diálogos (portais herdam o contexto). */
export function TemaGrccProvider({ children }: { children: React.ReactNode }) {
    const { claro, alternar } = useTemaGlobal();
    return <TemaContext.Provider value={{ claro, alternar }}>{children}</TemaContext.Provider>;
}

export function useTemaGrcc() {
    return useContext(TemaContext);
}

export function useClaro() {
    return useContext(TemaContext).claro;
}

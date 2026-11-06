// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IndicadorModal } from './IndicadorModal';
import type { LeadCidade } from '@/types/cidades';

const l = (id: number, p: Partial<LeadCidade>): LeadCidade => ({
    id, cliente: `C${id}`, solicitacao: '', status: '', categoria: 'Novo', valor: 0, uf: 'SP', municipio: 'Campinas', ...p,
});

const props = { aberto: true, claro: false, onFechar: () => {}, onAbrirLead: () => {} };

describe('IndicadorModal', () => {
    it('sem porCidade/porCliente mostra a lista plana', () => {
        render(<IndicadorModal {...props} detalhe={{ titulo: 'Total', descricao: '', leads: [l(1, { cliente: 'Limeira A' }), l(2, { cliente: 'Limeira A' })] }} />);
        expect(screen.queryAllByRole('heading', { level: 4 })).toHaveLength(0);
        expect(screen.getAllByText('Limeira A')).toHaveLength(2);
    });

    it('porCliente agrupa leads do mesmo cliente sob um cabeçalho', () => {
        render(
            <IndicadorModal
                {...props}
                detalhe={{
                    titulo: 'Total',
                    descricao: '',
                    porCliente: true,
                    leads: [l(1, { cliente: 'Limeira A' }), l(2, { cliente: 'Limeira A' }), l(3, { cliente: 'ALESP' })],
                }}
            />
        );
        const cabecalhos = screen.getAllByRole('heading', { level: 4 });
        expect(cabecalhos).toHaveLength(2);
        const limeira = cabecalhos.filter((h) => h.textContent?.includes('Limeira A'));
        expect(limeira).toHaveLength(1);
        expect(limeira[0].textContent).toMatch(/^Limeira A.*2/);
        expect(cabecalhos.some((h) => h.textContent?.startsWith('ALESP'))).toBe(true);
    });
});

// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuarterEditor } from './QuarterEditor';
import type { Manager } from '@/types/manager';

const manager = { id: 'grcc-debora', name: 'Débora', role: 'GRCC', year: 2026 } as unknown as Manager;

describe('QuarterEditor', () => {
    it('projeto gerado pela GRCC aparece travado com selo e link', () => {
        render(
            <QuarterEditor
                qKey="q3"
                manager={manager}
                onChange={() => {}}
                quarterData={{ total: 10, projects: [{ name: 'Chatbot', orgao: 'ALESP', value: 10, temperature: 'quente', leadGrccId: 4 }, { name: 'Manual', value: 1 }] }}
            />
        );
        expect(screen.getByText('Gerenciado pela GRCC')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Editar em \/grcc/ })).toHaveAttribute('href', '/grcc');
        expect(screen.getByDisplayValue('Chatbot')).toBeDisabled();
        expect(screen.getByDisplayValue('Manual')).toBeEnabled();
    });
});

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Manager } from '@/types/manager';

vi.mock('@/app/settings/fetchActions', () => ({ getCXByManager: vi.fn(), getVisitsByManager: vi.fn(), getChurnByManager: vi.fn() }));
import { ManagerEditor } from './ManagerEditor';

const q = { total: 0, projects: [] };
const manager = { id: 'g1', name: 'Barone', role: 'GRC3', avatarUrl: '', year: 2026, meta: 0, contratado: 0, forecastFinal: 0, pipeline: { q1: q, q2: q, q3: q, q4: q, nao_mapeado: q }, cx: [], visits: [], churn: [] } as Manager;
const editor = (isSaving: boolean) => <ManagerEditor manager={manager} onChange={vi.fn()} onExtrasCarregados={vi.fn()} onSave={vi.fn()} isSaving={isSaving} />;

describe('ManagerEditor', () => {
    it('campos ficam desabilitados enquanto salva', () => {
        const { rerender } = render(editor(true));
        expect(screen.getByDisplayValue('Barone')).toBeDisabled();
        expect(screen.getByRole('switch')).toBeDisabled();
        rerender(editor(false));
        expect(screen.getByDisplayValue('Barone')).toBeEnabled();
    });
});

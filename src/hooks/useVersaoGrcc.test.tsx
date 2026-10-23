// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const versaoGrcc = vi.fn();
vi.mock('@/services/grcc.service', () => ({ versaoGrcc: () => versaoGrcc() }));
const { useVersaoGrcc } = await import('./useVersaoGrcc');

async function tick(ms: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    versaoGrcc.mockReset();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});
afterEach(() => vi.useRealTimers());

describe('useVersaoGrcc', () => {
    it('só chama onMudou quando a versão muda (não na primeira leitura)', async () => {
        versaoGrcc.mockResolvedValueOnce(3).mockResolvedValueOnce(3).mockResolvedValueOnce(4);
        const onMudou = vi.fn();
        renderHook(() => useVersaoGrcc(onMudou, 15000));
        await tick(0);
        expect(onMudou).not.toHaveBeenCalled();
        await tick(15000);
        expect(onMudou).not.toHaveBeenCalled();
        await tick(15000);
        expect(onMudou).toHaveBeenCalledTimes(1);
    });

    it('pausa com a aba escondida e checa na hora ao voltar', async () => {
        versaoGrcc.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
        const onMudou = vi.fn();
        renderHook(() => useVersaoGrcc(onMudou, 15000));
        await tick(0);
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        await tick(45000);
        expect(versaoGrcc).toHaveBeenCalledTimes(1);
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(onMudou).toHaveBeenCalledTimes(1);
    });

    it('mensagem no BroadcastChannel dispara onMudou na hora', async () => {
        versaoGrcc.mockResolvedValue(1);
        const onMudou = vi.fn();
        renderHook(() => useVersaoGrcc(onMudou, 15000));
        await tick(0);
        await act(async () => {
            const c = new BroadcastChannel('grcc');
            c.postMessage({ tipo: 'leads-mudaram' });
            c.close();
            await vi.advanceTimersByTimeAsync(10);
        });
        expect(onMudou).toHaveBeenCalledTimes(1);
    });

    it('falha na checagem é silenciosa e o polling continua', async () => {
        versaoGrcc.mockRejectedValueOnce(new Error('rede')).mockResolvedValue(1);
        const onMudou = vi.fn();
        renderHook(() => useVersaoGrcc(onMudou, 15000));
        await tick(30000);
        expect(onMudou).not.toHaveBeenCalled();
        expect(versaoGrcc).toHaveBeenCalledTimes(3);
    });

    it('limpa intervalo e canal ao desmontar', async () => {
        versaoGrcc.mockResolvedValue(1);
        const onMudou = vi.fn();
        const { unmount } = renderHook(() => useVersaoGrcc(onMudou, 15000));
        await tick(0);
        unmount();
        await tick(45000);
        expect(versaoGrcc).toHaveBeenCalledTimes(1);
        await act(async () => {
            const c = new BroadcastChannel('grcc');
            c.postMessage({ tipo: 'leads-mudaram' });
            c.close();
            await vi.advanceTimersByTimeAsync(10);
        });
        expect(onMudou).not.toHaveBeenCalled();
    });
});

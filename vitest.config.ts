import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        setupFiles: ['./vitest.setup.ts'],
        // Vitest 5 já limpa mocks (histórico de chamadas) entre testes por padrão — deixamos
        // explícito aqui pra não depender de um default implícito que uma major futura pode
        // mudar, e pra deixar claro que asserções como `toHaveBeenCalledTimes(N)` espalhadas
        // pela suíte dependem disso.
        clearMocks: true,
        // Padrão é 'node' (queries.ts, actions, rotas de API, calc.ts). Um arquivo *.test.tsx que
        // precisa de DOM (Testing Library) deve começar com o pragma `// @vitest-environment jsdom`
        // na primeira linha do arquivo — não existe roteamento automático por extensão nesta versão
        // do Vitest (a chave de config `environmentMatchGlobs` foi removida upstream).
        environment: 'node',
        css: false,
    },
});

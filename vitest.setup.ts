import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// vitest.config.ts não seta `test.globals: true`, e cada arquivo de teste importa `afterEach`
// explicitamente de 'vitest' — então o auto-cleanup que @testing-library/react registraria
// sozinho (via `if (typeof afterEach === 'function')` global) nunca dispara neste repo. Sem
// isso, o DOM de um `render()` de um teste vaza pro próximo dentro do mesmo arquivo. É um
// no-op seguro em arquivos que nunca montam nada (testes de queries.ts, Server Actions, etc.).
afterEach(() => {
    cleanup();
});

// Testes de integração (queries.ts, Server Actions, rotas de API externa)
// rodam contra um SQLite/LibSQL real EM MEMÓRIA — nunca contra o Turso de
// verdade. Isso precisa ser setado antes de qualquer teste importar
// '@/db/index' (setupFiles roda antes do arquivo de teste, então essa ordem
// é garantida pelo próprio Vitest).
process.env.TURSO_DATABASE_URL = 'file::memory:';
process.env.JWT_SECRET = 'segredo-de-teste-nao-usar-em-producao';
process.env.COOKIE_NAME = 'session';

// Radix Select (usado por vários componentes com edição inline/formulários) chama essas APIs de
// ponteiro/scroll que o jsdom não implementa — sem os stubs, abrir o dropdown ou clicar num item
// lança TypeError. Registrado globalmente aqui (não por arquivo de teste) porque afeta múltiplos
// componentes em vários sub-projetos/ondas (ex.: NovoUsuarioModal, CXPlannerItemModal,
// DashboardShell, AppHeader).
if (typeof Element !== 'undefined') {
    if (!Element.prototype.hasPointerCapture) {
        Element.prototype.hasPointerCapture = () => false;
    }
    if (!Element.prototype.setPointerCapture) {
        Element.prototype.setPointerCapture = () => {};
    }
    if (!Element.prototype.releasePointerCapture) {
        Element.prototype.releasePointerCapture = () => {};
    }
    if (!Element.prototype.scrollIntoView) {
        Element.prototype.scrollIntoView = () => {};
    }
}

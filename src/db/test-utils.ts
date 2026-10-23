import { readFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import os from 'os';

const MIGRATIONS_DIR = join(process.cwd(), 'src/db/migrations');

async function applyMigrationsTo(targetDb: { $client: { execute: (sql: string) => Promise<unknown> } }): Promise<void> {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
        const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
        // Mesma regra do migrate.ts: separa por breakpoint do drizzle-kit OU por `;` no fim da linha.
        const statements = sql
            .split(/(?:--> statement-breakpoint|;\s*(?:\r?\n|$))/)
            .map((s) => s.trim())
            .filter(Boolean);
        for (const stmt of statements) {
            try {
                await targetDb.$client.execute(stmt);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                if (/duplicate column|already exists/i.test(msg)) continue;
                throw err;
            }
        }
    }
}

/**
 * Aplica todas as migrations de src/db/migrations/ contra o `db` atual (importado
 * dinamicamente aqui dentro, então funciona tanto contra o `file::memory:` padrão de
 * vitest.setup.ts quanto contra o banco de `createTransactionSafeTestDb()` abaixo).
 * Chamar uma vez por arquivo de teste (ex.: em `beforeAll`) — exige que
 * `process.env.TURSO_DATABASE_URL` já aponte pro banco descartável ANTES de '@/db/index'
 * ser importado em algum lugar da árvore de módulos daquele arquivo.
 */
export async function applyMigrations(): Promise<void> {
    const { db } = await import('./index');
    return applyMigrationsTo(db);
}

// ── Banco de teste seguro para `db.transaction()` ───────────────────────────

const TX_SAFE_TMP_PREFIX = 'tx-safe-test-';

let alreadyCalled = false;

/**
 * Remove arquivos de banco temporário deixados por execuções ANTERIORES de
 * `createTransactionSafeTestDb()` (processos que já terminaram). Chamado no início de cada
 * `createTransactionSafeTestDb()` — é o que de fato mantém o diretório temp limpo ao longo
 * do tempo (ver comentário da função abaixo sobre por que confiar só em `afterAll` +
 * `unlink` não funciona).
 *
 * A segurança aqui vem de checar se o PID embutido no nome do arquivo (formato
 * `${TX_SAFE_TMP_PREFIX}${pid}-${timestamp}-${hex}.db`) ainda pertence a um processo vivo
 * — via `process.kill(pid, 0)`, que NÃO envia sinal nenhum, só lança `ESRCH` se o processo
 * não existir mais. Um arquivo cujo dono ainda está vivo é pulado; um PID malformado
 * também é pulado (mais seguro deixar um arquivo órfão do que arriscar apagar o de outro
 * processo). Isso é o que de fato impede apagar o banco de um worker irmão ainda rodando.
 *
 * Nota histórica: a versão anterior desta função não checava o PID e dependia de
 * `unlinkSync` falhar com EBUSY quando o arquivo ainda estava aberto por outro processo —
 * o que só é verdade no Windows. No POSIX (Linux/macOS), `unlinkSync` num arquivo aberto
 * por outro processo TEM SUCESSO silenciosamente: o file descriptor do processo vítima
 * continua funcionando, mas o CAMINHO some. Como `createTransactionSafeTestDb()` depende
 * do driver libsql reconectar POR CAMINHO a cada `db.transaction()`, a próxima reconexão
 * de um worker irmão no meio do teste abriria o caminho (agora ausente) e criaria
 * silenciosamente um banco NOVO E VAZIO — reintroduzindo, de forma não determinística, o
 * exato bug que este helper existe para evitar. A checagem de PID abaixo é a proteção real
 * hoje; o comportamento de EBUSY do Windows não é mais o mecanismo de segurança.
 */
function sweepStaleTxSafeTempFiles(): void {
    const dir = os.tmpdir();
    let entries: string[];
    try {
        entries = readdirSync(dir);
    } catch {
        return;
    }
    for (const name of entries) {
        if (!name.startsWith(TX_SAFE_TMP_PREFIX)) continue;

        const rest = name.slice(TX_SAFE_TMP_PREFIX.length);
        const pidSegment = rest.split('-')[0];
        const pid = Number(pidSegment);
        if (!pidSegment || !Number.isInteger(pid) || pid <= 0) {
            // PID não parseável no nome do arquivo — mais seguro deixar o arquivo do
            // que arriscar apagar o banco de outro processo.
            continue;
        }

        try {
            process.kill(pid, 0);
            // Não lançou: o processo dono ainda está vivo — pula, é o próprio
            // arquivo em uso (ou, em tese, outro worker ainda rodando).
            continue;
        } catch {
            // Lançou ESRCH (ou similar): processo já terminou, seguro apagar.
        }

        try {
            unlinkSync(join(dir, name));
        } catch {
            // Condição transitória — deixa pra próxima varredura.
        }
    }
}

/**
 * Cria um banco de teste NÃO anônimo (arquivo temporário real, não `:memory:`) e faz o
 * import dinâmico de `@/db/index` depois de apontar a env var pra ele. Necessário só pros
 * (poucos) testes que exercitam código de produção usando `db.transaction()` — o driver
 * libsql local invalida a conexão em cache ao abrir uma transação; contra um `:memory:`
 * anônimo (o padrão global de `vitest.setup.ts`), a reconexão "preguiçosa" seguinte abre
 * um banco NOVO E VAZIO em vez de reabrir o mesmo. Um arquivo real reabre o mesmo banco ao
 * reconectar.
 *
 * IMPORTANTE: chame isto ANTES de qualquer import estático de `@/db/index` (ou de
 * qualquer módulo que o importe transitivamente, ex. `@/db/queries` ou uma rota) no
 * arquivo de teste — a env var só é lida na primeira vez que `@/db/index` é avaliado. Use
 * import dinâmico (`await import(...)`) pro que vier depois desta chamada.
 *
 * IMPORTANTE também: chame isto NO MÁXIMO UMA VEZ por processo de teste (um arquivo de
 * teste, no `pool: 'forks'` padrão do Vitest). Uma segunda chamada no mesmo processo
 * lançaria erro — ver por quê no throw abaixo. Se você precisa de um banco limpo por
 * teste, faça isso com `beforeEach` limpando as tabelas via `db.delete(...)` sobre o
 * MESMO `db` retornado aqui, não chamando esta função de novo.
 *
 * Limpeza: cada chamada de teste abre pelo menos uma transação, e
 * `Sqlite3Transaction.close()` do driver só faz `ROLLBACK` — nunca fecha de fato o handle
 * do `Database` que `.transaction()` abriu — então o arquivo temporário fica com um
 * handle de SO aberto para sempre dentro do processo de teste. Por isso `afterAll` +
 * `fs.unlinkSync` sozinho SEMPRE falha com EBUSY no Windows (o handle nunca foi
 * liberado). A limpeza que de fato funciona é a varredura no início desta função: quando
 * o PRÓXIMO processo de teste chama `createTransactionSafeTestDb()`, o processo anterior
 * já terminou e o SO já liberou os handles dele, então os arquivos antigos apagam sem
 * erro. Ainda chamamos `db.$client.close()` num `afterAll` melhor-esforço no arquivo de
 * teste (inofensivo), mas ele só fecha a conexão mais recente (a recriada após a última
 * transação) — não as anteriores, que ficaram vazando — então não é suficiente sozinho.
 */
export async function createTransactionSafeTestDb(): Promise<{
    db: (typeof import('./index'))['db'];
    applyMigrations: () => Promise<void>;
}> {
    if (alreadyCalled) {
        throw new Error(
            'createTransactionSafeTestDb() só pode ser chamado uma vez por processo de ' +
                'teste — o import de "./index" é cacheado pelo Node, então uma segunda ' +
                'chamada retornaria o `db` da primeira conexão (ainda apontando pro ' +
                'primeiro arquivo temporário), não uma nova conexão pro novo arquivo/env ' +
                'var, silenciosamente. Se você precisa de dados limpos por teste, faça ' +
                'isso com `beforeEach` limpando as tabelas via `db.delete(...)` sobre o ' +
                '`db` já retornado, não chamando esta função de novo.'
        );
    }

    sweepStaleTxSafeTempFiles();

    const tmpFile = join(
        os.tmpdir(),
        `${TX_SAFE_TMP_PREFIX}${process.pid}-${Date.now()}-${randomBytes(4).toString('hex')}.db`
    ).replace(/\\/g, '/');

    process.env.TURSO_DATABASE_URL = `file:${tmpFile}`;

    const { db } = await import('./index');

    alreadyCalled = true;

    return {
        db,
        applyMigrations: () => applyMigrationsTo(db),
    };
}

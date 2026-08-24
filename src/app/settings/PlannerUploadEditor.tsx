'use client';

import { useRef, useState } from 'react';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { uploadPlannerTasks } from '@/services/planner-upload.service';

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

// Aceita tanto um array cru de tarefas quanto { tasks: [...] } — mesmo
// formato flexível que os endpoints /planner-sync já aceitam.
function extractTasksArray(parsed: unknown, filename: string): unknown[] {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { tasks?: unknown }).tasks)) {
        return (parsed as { tasks: unknown[] }).tasks;
    }
    throw new Error(`"${filename}" não é uma lista de tarefas nem um objeto { tasks: [...] }.`);
}

/**
 * Painel administrativo (Settings, atrás de SETTINGS_KEY) para o upload
 * manual do JSON exportado do Planner. Antes vivia como botão solto em
 * CXTab.tsx, acessível a qualquer um com a FRONTEND_KEY (todo o dashboard);
 * mudou de lugar por ser uma ação de escrita em massa — sincroniza o CX de
 * TODOS os gerentes de uma vez (casando cada tarefa pelo servedClients),
 * não só de quem está selecionado no Settings.
 *
 * A lógica de leitura/parse/validação/sincronização é a mesma de antes —
 * ver uploadPlannerTasks (src/services/planner-upload.service.ts) e
 * syncPlannerTasks (src/lib/planner-sync.ts).
 */
export function PlannerUploadEditor() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadState, setUploadState] = useState<UploadState>('idle');
    const [uploadMessage, setUploadMessage] = useState<string | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploadState('uploading');
        setUploadMessage(null);

        try {
            const allTasks: unknown[] = [];
            for (const file of Array.from(files)) {
                const text = await file.text();
                let parsed: unknown;
                try {
                    parsed = JSON.parse(text);
                } catch {
                    throw new Error(`"${file.name}" não é um JSON válido.`);
                }
                allTasks.push(...extractTasksArray(parsed, file.name));
            }

            if (allTasks.length === 0) {
                throw new Error('Nenhuma tarefa encontrada no(s) arquivo(s) selecionado(s).');
            }

            const result = await uploadPlannerTasks({ tasks: allTasks });
            if (!result.success) {
                setUploadState('error');
                setUploadMessage(result.error);
                return;
            }

            const s = result.summary;
            setUploadState('done');
            setUploadMessage(
                `${s.total} tarefa${s.total === 1 ? '' : 's'} processada${s.total === 1 ? '' : 's'} — ` +
                `${s.created} criada${s.created === 1 ? '' : 's'}, ${s.updated} atualizada${s.updated === 1 ? '' : 's'}` +
                (s.unmatched.length > 0 ? `, ${s.unmatched.length} sem gerente` : '') +
                '.'
            );
        } catch (err) {
            setUploadState('error');
            setUploadMessage(err instanceof Error ? err.message : 'Erro inesperado ao processar o upload.');
        } finally {
            // Permite selecionar o(s) mesmo(s) arquivo(s) de novo depois.
            e.target.value = '';
        }
    };

    return (
        <div className="max-w-3xl space-y-6 p-2">
            <div>
                <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                    <Upload className="w-6 h-6 text-indigo-400" />
                    Upload Planner (CX)
                </h3>
                <p className="text-sm text-zinc-400 mt-1">
                    Envie o(s) JSON exportado(s) do Planner para sincronizar o CX de todos os gerentes de uma vez
                    (cada tarefa é casada com o gerente pelos clientes atendidos).
                </p>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-6">
                <div className="space-y-2">
                    <label className="block text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                        Arquivo(s) JSON
                    </label>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadState === 'uploading'}
                        className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {uploadState === 'uploading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        Selecionar JSON
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,application/json"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <p className="text-xs text-zinc-500">
                        Aceita um array de tarefas ou um objeto {'{ tasks: [...] }'}, com um ou vários arquivos ao mesmo tempo.
                    </p>
                </div>

                {uploadState !== 'idle' && (
                    <div
                        className={`p-3 rounded-xl text-sm flex items-center gap-2 border ${uploadState === 'uploading'
                            ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                            : uploadState === 'done'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-red-500/10 border-red-500/30 text-red-400'
                            }`}
                    >
                        {uploadState === 'uploading' && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                        {uploadState === 'done' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                        {uploadState === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
                        <span>{uploadState === 'uploading' ? 'Processando arquivo(s)...' : uploadMessage}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

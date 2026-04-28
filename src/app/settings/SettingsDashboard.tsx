'use client';

import { useState, useEffect } from 'react';
import { fetchManagers } from '@/services/managers.service';
import { Manager } from '@/types/manager';
import { Loader2, User, Save, FileText } from 'lucide-react';
import { ManagerEditor } from './ManagerEditor';
import { ContractsEditor } from './ContractsEditor';
import { saveManagerData, saveCXData, saveVisitsData } from './actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

export function SettingsDashboard() {
    const [managers, setManagers] = useState<Manager[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [section, setSection] = useState<'managers' | 'contracts'>('managers');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const loadData = async () => {
        setIsLoading(true);
        const data = await fetchManagers();
        setManagers(data);
        if (data.length > 0 && !selectedId) {
            setSelectedId(data[0].id);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const selectedManager = managers.find(m => m.id === selectedId);

    const handleUpdateManager = (updatedManager: Manager) => {
        setManagers(prev => prev.map(m => m.id === updatedManager.id ? updatedManager : m));
    };

    const handleSave = async () => {
        if (!selectedManager) return;
        setIsSaving(true);
        setSaveStatus('idle');
        try {
            await Promise.all([
                saveManagerData(selectedManager),
                saveCXData(selectedManager.id, selectedManager.cx || []),
                saveVisitsData(selectedManager.id, selectedManager.visits || []),
            ]);
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (e) {
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col md:flex-row">
            {/* Sidebar */}
            <aside className="w-full md:w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col h-screen z-10 sticky top-0 md:sticky">
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                    <div>
                        <Link href="/" className="flex items-center gap-2">

                            <h2 className="text-xl font-bold">Admin Panel</h2>
                            <p className="text-zinc-500 text-sm">Dashboard Data</p>
                        </Link>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {managers.map(m => (
                        <button
                            key={m.id}
                            onClick={() => { setSelectedId(m.id); setSection('managers'); }}
                            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors ${section === 'managers' && selectedId === m.id ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-800'}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${section === 'managers' && selectedId === m.id ? 'bg-indigo-500' : 'bg-zinc-800'}`}>
                                <User className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate text-sm">{m.name}</p>
                                <p className={`text-xs truncate ${section === 'managers' && selectedId === m.id ? 'text-indigo-200' : 'text-zinc-500'}`}>{m.role}</p>
                            </div>
                        </button>
                    ))}

                    <div className="pt-2 border-t border-zinc-800 mt-2">
                        <button
                            onClick={() => setSection('contracts')}
                            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors ${section === 'contracts' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-800'}`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${section === 'contracts' ? 'bg-indigo-500' : 'bg-zinc-800'}`}>
                                <FileText className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate text-sm">Contratos</p>
                                <p className={`text-xs truncate ${section === 'contracts' ? 'text-indigo-200' : 'text-zinc-500'}`}>Gestão de contratos</p>
                            </div>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 h-screen overflow-y-auto bg-zinc-950 p-4 md:p-8">
                {saveStatus === 'success' && (
                    <Alert className="mb-6 bg-green-500/10 border-green-500/50 text-green-400">
                        <Save className="h-4 w-4" />
                        <AlertTitle>Sucesso!</AlertTitle>
                        <AlertDescription>Dados do gerente atualizados e persistidos no banco (Turso) com sucesso.</AlertDescription>
                    </Alert>
                )}
                {saveStatus === 'error' && (
                    <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/50 text-red-500">
                        <AlertTitle>Erro</AlertTitle>
                        <AlertDescription>Ocorreu um erro ao salvar os dados no banco. Tente novamente.</AlertDescription>
                    </Alert>
                )}

                {section === 'contracts' ? (
                    <ContractsEditor />
                ) : selectedManager ? (
                    <ManagerEditor
                        key={selectedManager.id}
                        manager={selectedManager}
                        onChange={handleUpdateManager}
                        onSave={handleSave}
                        isSaving={isSaving}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-zinc-500">
                        Selecione um gerente na lateral para editar.
                    </div>
                )}
            </main>
        </div>
    );
}

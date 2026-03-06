'use client';

import { useState, useEffect } from 'react';
import { verifySettingsKey } from './actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

export function KeyGate({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    useEffect(() => {
        // Simple client-side persistence check
        const storedKey = localStorage.getItem('SETTINGS_KEY');
        if (storedKey) {
            verifySettingsKey(storedKey).then(isValid => {
                if (isValid) {
                    setIsAuthenticated(true);
                } else {
                    localStorage.removeItem('SETTINGS_KEY');
                }
                setIsChecking(false);
            });
        } else {
            setIsChecking(false);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(false);
        setIsChecking(true);
        const isValid = await verifySettingsKey(password);
        if (isValid) {
            localStorage.setItem('SETTINGS_KEY', password);
            setIsAuthenticated(true);
        } else {
            setError(true);
        }
        setIsChecking(false);
    };

    if (isChecking && !isAuthenticated) {
        return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-6 h-6 border-2 border-indigo-500 rounded-full animate-spin border-t-transparent" /></div>;
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center">
                    <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                        <Lock className="w-8 h-8 text-zinc-400" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
                    <p className="text-zinc-400 text-center mb-8">Esta área é administrativa e necessita de chave de acesso.</p>

                    <form onSubmit={handleSubmit} className="w-full space-y-4">
                        <Input
                            type="password"
                            placeholder="Insira a chave..."
                            className="bg-zinc-950 border-zinc-800 focus-visible:ring-indigo-500"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        {error && <p className="text-red-400 text-sm font-medium">Chave incorreta. Tente novamente.</p>}
                        <Button type="submit" disabled={isChecking} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                            Liberar Acesso
                        </Button>
                    </form>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

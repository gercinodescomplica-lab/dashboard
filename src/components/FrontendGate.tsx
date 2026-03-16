'use client';

import { useState, useEffect } from 'react';
import { verifyAccessKey } from '@/app/auth/actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

const STORAGE_KEY = 'FRONTEND_ACCESS';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getStoredAccess(): { key: string; storedAt: number } | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function isAccessValid(stored: { key: string; storedAt: number } | null): boolean {
    if (!stored) return false;
    return Date.now() - stored.storedAt < THIRTY_DAYS_MS;
}

export function FrontendGate({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);
    const [expired, setExpired] = useState(false);

    useEffect(() => {
        const stored = getStoredAccess();
        if (stored && isAccessValid(stored)) {
            verifyAccessKey(stored.key).then(isValid => {
                if (isValid) {
                    setIsAuthenticated(true);
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                }
                setIsChecking(false);
            });
        } else {
            if (stored && !isAccessValid(stored)) {
                localStorage.removeItem(STORAGE_KEY);
                setExpired(true);
            }
            setIsChecking(false);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(false);
        setIsChecking(true);
        const isValid = await verifyAccessKey(password);
        if (isValid) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ key: password, storedAt: Date.now() }));
            setIsAuthenticated(true);
            setExpired(false);
        } else {
            setError(true);
        }
        setIsChecking(false);
    };

    if (isChecking && !isAuthenticated) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-indigo-500 rounded-full animate-spin border-t-transparent" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center">
                    <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                        <Lock className="w-8 h-8 text-zinc-400" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Dashboard DRM</h1>
                    {expired ? (
                        <p className="text-amber-400 text-center mb-8 text-sm">Seu acesso expirou após 30 dias. Insira o token novamente para continuar.</p>
                    ) : (
                        <p className="text-zinc-400 text-center mb-8">Insira o token de acesso para visualizar o dashboard.</p>
                    )}

                    <form onSubmit={handleSubmit} className="w-full space-y-4">
                        <Input
                            type="password"
                            placeholder="Insira o token..."
                            className="bg-zinc-950 border-zinc-800 focus-visible:ring-indigo-500"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoFocus
                        />
                        {error && <p className="text-red-400 text-sm font-medium">Token incorreto. Tente novamente.</p>}
                        <Button type="submit" disabled={isChecking} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                            {isChecking ? 'Verificando...' : 'Acessar'}
                        </Button>
                    </form>

                    <p className="text-zinc-600 text-xs mt-6">O acesso é válido por 30 dias após a inserção do token.</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

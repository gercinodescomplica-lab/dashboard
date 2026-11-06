'use client';
// Organograma de clientes no admin (spec 2026-11-06 §8.2): abas Editar | Organograma | A conferir.
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import * as acoes from '@/app/settings/carteiraActions';
import type { PainelCarteira } from '@/app/settings/carteiraActions';
import { lerChaveSettings } from '@/app/settings/chaveLocal';
import { ROTULO_DO_GRUPO, grupoDaGerencia } from '@/lib/carteira/organograma-clientes';
import type { Resultado } from '@/lib/carteira/tipos';
import { OrganogramaClientesView } from './quadro';
import { EditorGerencia } from './editor-gerencia';
import { AConferir } from './a-conferir';

export type Rodar = <T>(acao: (chave: string) => Promise<Resultado<T>>, sucesso: string) => Promise<boolean>;

export function OrganogramaClientesAdmin() {
    const [painel, setPainel] = useState<PainelCarteira | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);
    const [busca, setBusca] = useState('');
    const [criando, setCriando] = useState(false);

    const carregar = useCallback(async () => {
        const r = await acoes.carregarPainelCarteiraAction(lerChaveSettings());
        if (r.ok) setPainel(r.valor);
        else setErro(r.erro);
    }, []);

    useEffect(() => { void carregar(); }, [carregar]);

    const rodar: Rodar = async (acao, sucesso) => {
        setErro(null);
        setAviso(null);
        const r = await acao(lerChaveSettings());
        if (r.ok) setAviso(sucesso);
        else setErro(r.erro);
        await carregar();
        return r.ok;
    };

    if (!painel) return erro ? <Notice tom="perigo">{erro}</Notice> : <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />;

    const termo = busca.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const visiveis = painel.gerencias.filter((g) =>
        !termo || [g.chave, g.nome, ...g.clientes.map((c) => `${c.sigla ?? ''} ${c.nome}`)].join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(termo));

    return (
        <div className="space-y-4">
            <header>
                <h1 className="text-2xl font-bold text-zinc-50">Organograma de clientes</h1>
                <p className="text-sm text-zinc-400">Cada coluna é uma gerência e cada cartão, a carteira dela. O que muda aqui muda no organograma do dashboard.</p>
            </header>
            {erro && <Notice tom="perigo">{erro}</Notice>}
            {aviso && <Notice tom="sucesso">{aviso}</Notice>}
            <Tabs defaultValue="editar" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <TabsList>
                        <TabsTrigger value="editar">Editar</TabsTrigger>
                        <TabsTrigger value="organograma">Organograma</TabsTrigger>
                        <TabsTrigger value="conferir">A conferir</TabsTrigger>
                    </TabsList>
                    <Button onClick={() => setCriando(true)}><Plus className="mr-1 h-4 w-4" /> Nova gerência</Button>
                </div>
                <TabsContent value="editar" className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <Input type="search" aria-label="Buscar no organograma" placeholder="Buscar gerência, gerente ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-sm" />
                        <p className="text-sm text-zinc-400" aria-live="polite">{visiveis.length} de {painel.gerencias.length} gerência(s) · {painel.semCarteira.length} cliente(s) sem carteira</p>
                    </div>
                    {visiveis.map((g) => <EditorGerencia key={`${g.chave}:${g.nome}:${g.visivel}`} g={g} semCarteira={painel.semCarteira} rodar={rodar} />)}
                </TabsContent>
                <TabsContent value="organograma">
                    <div className="h-[75dvh] min-h-96">
                        <OrganogramaClientesView dados={painel.organograma} podeMover moverAction={(id, de, para) => acoes.moverClienteNoOrganogramaAction(lerChaveSettings(), id, de, para)} aoMudar={carregar} />
                    </div>
                </TabsContent>
                <TabsContent value="conferir">
                    <AConferir painel={painel} rodar={rodar} />
                </TabsContent>
            </Tabs>
            <NovaGerencia aberto={criando} aoFechar={() => setCriando(false)} rodar={rodar} />
        </div>
    );
}

function NovaGerencia({ aberto, aoFechar, rodar }: { aberto: boolean; aoFechar: () => void; rodar: Rodar }) {
    const [sigla, setSigla] = useState('');
    const [nome, setNome] = useState('');
    const fechar = () => { setSigla(''); setNome(''); aoFechar(); };
    const { grupo } = grupoDaGerencia({ sigla: sigla || null, nome });
    return (
        <Dialog open={aberto} onOpenChange={(a) => { if (!a) fechar(); }}>
            <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-50">
                <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (await rodar((k) => acoes.criarGerenciaAction(k, { sigla, nome }), 'Gerência criada. Agora ponha os clientes.')) fechar(); }}>
                    <DialogHeader><DialogTitle>Nova gerência</DialogTitle></DialogHeader>
                    <label className="block text-sm">Sigla<Input value={sigla} onChange={(e) => setSigla(e.target.value)} required autoFocus /></label>
                    <label className="block text-sm">Nome do gerente<Input value={nome} onChange={(e) => setNome(e.target.value)} required /></label>
                    <p className="text-xs text-zinc-400">Coluna no organograma: {ROTULO_DO_GRUPO[grupo]} (vem da sigla: KAM1, GRC2, GRCC…).</p>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={fechar}>Cancelar</Button>
                        <Button type="submit">Criar gerência</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

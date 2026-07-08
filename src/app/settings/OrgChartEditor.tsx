'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Save, Loader2, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import {
    ORG_TAG_LABELS,
    ORG_COLORS,
    type OrgChartData,
    type OrgTag,
    type OrgColor,
    type OrgPerson,
    type OrgSection,
    type OrgDepartment,
    type OrgSubdirector,
} from '@/types/orgChart';
import { fetchOrgChart, saveOrgChart } from './orgChartActions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function uid(prefix: string) {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

const TAG_OPTIONS: { value: OrgTag | ''; label: string }[] = [
    { value: '', label: '— sem tag —' },
    { value: 'a_confirmar', label: ORG_TAG_LABELS.a_confirmar },
    { value: 'em_contratacao', label: ORG_TAG_LABELS.em_contratacao },
    { value: 'a_contratar', label: ORG_TAG_LABELS.a_contratar },
];

const COLOR_SWATCH: Record<OrgColor, string> = {
    indigo: 'bg-indigo-600',
    emerald: 'bg-emerald-600',
    amber: 'bg-amber-600',
    purple: 'bg-purple-700',
    pink: 'bg-pink-700',
};

function PersonEditor({ person, onChange, onRemove }: { person: OrgPerson; onChange: (p: OrgPerson) => void; onRemove: () => void }) {
    return (
        <div className="flex items-center gap-2 p-2 bg-zinc-950 border border-zinc-800 rounded-md">
            <Input
                value={person.name}
                onChange={(e) => onChange({ ...person, name: e.target.value })}
                placeholder="Nome"
                className="bg-zinc-900 border-zinc-800 text-zinc-200 h-8 text-sm flex-1"
            />
            <select
                value={person.tag ?? ''}
                onChange={(e) => onChange({ ...person, tag: (e.target.value || undefined) as OrgTag | undefined })}
                className="bg-zinc-900 border border-zinc-800 rounded-md text-zinc-300 text-xs h-8 px-2"
            >
                {TAG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 h-8 px-2">
                <Trash2 className="w-3.5 h-3.5" />
            </Button>
        </div>
    );
}

function SectionEditor({ section, onChange, onRemove, onMoveUp, onMoveDown }: {
    section: OrgSection;
    onChange: (s: OrgSection) => void;
    onRemove: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}) {
    const addPerson = () => onChange({ ...section, people: [...section.people, { name: 'Novo' }] });
    const updatePerson = (i: number, p: OrgPerson) => onChange({ ...section, people: section.people.map((x, idx) => idx === i ? p : x) });
    const removePerson = (i: number) => onChange({ ...section, people: section.people.filter((_, idx) => idx !== i) });

    return (
        <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/50 space-y-3">
            <div className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={onMoveUp} className="text-zinc-600 hover:text-zinc-300 text-xs leading-none">▲</button>
                    <button type="button" onClick={onMoveDown} className="text-zinc-600 hover:text-zinc-300 text-xs leading-none">▼</button>
                </div>
                <Input
                    value={section.name}
                    onChange={(e) => onChange({ ...section, name: e.target.value })}
                    placeholder="Nome (ex: MALDE)"
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 h-8 text-sm font-bold flex-1"
                />
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span>Núcleo</span>
                    <Switch checked={!!section.isNucleo} onCheckedChange={(v) => onChange({ ...section, isNucleo: v })} />
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 h-8 px-2">
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>

            {section.isNucleo && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
                    <div>
                        <Label className="text-xs text-zinc-500">Subtítulo do núcleo</Label>
                        <Input
                            value={section.nucleoSubtitle ?? ''}
                            onChange={(e) => onChange({ ...section, nucleoSubtitle: e.target.value })}
                            placeholder="Ex: Núcleo Suporte Operacional"
                            className="bg-zinc-950 border-zinc-800 text-zinc-200 h-8 text-sm"
                        />
                    </div>
                    <div>
                        <Label className="text-xs text-zinc-500">Líder do núcleo</Label>
                        <Input
                            value={section.leader?.name ?? ''}
                            onChange={(e) => onChange({ ...section, leader: e.target.value ? { name: e.target.value } : undefined })}
                            placeholder="Ex: OSCAR"
                            className="bg-zinc-950 border-zinc-800 text-zinc-200 h-8 text-sm font-bold"
                        />
                    </div>
                </div>
            )}

            <div className="pl-8 space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs text-zinc-500">Pessoas ({section.people.length})</Label>
                    <Button type="button" size="sm" variant="ghost" onClick={addPerson} className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 h-7 text-xs">
                        <Plus className="w-3 h-3 mr-1" /> Pessoa
                    </Button>
                </div>
                {section.people.length === 0 ? (
                    <p className="text-xs text-zinc-600 italic">Nenhuma pessoa.</p>
                ) : (
                    <div className="space-y-1.5">
                        {section.people.map((p, i) => (
                            <PersonEditor
                                key={i}
                                person={p}
                                onChange={(np) => updatePerson(i, np)}
                                onRemove={() => removePerson(i)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function DepartmentEditor({ dept, onChange, onRemove, onMoveUp, onMoveDown }: {
    dept: OrgDepartment;
    onChange: (d: OrgDepartment) => void;
    onRemove: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}) {
    const [expanded, setExpanded] = useState(true);

    const addSection = () => onChange({
        ...dept,
        sections: [...dept.sections, { id: uid('sec'), name: 'NOVA SEÇÃO', people: [] }],
    });
    const updateSection = (i: number, s: OrgSection) => onChange({ ...dept, sections: dept.sections.map((x, idx) => idx === i ? s : x) });
    const removeSection = (i: number) => onChange({ ...dept, sections: dept.sections.filter((_, idx) => idx !== i) });
    const moveSection = (i: number, dir: -1 | 1) => {
        const next = [...dept.sections];
        const j = i + dir;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j], next[i]];
        onChange({ ...dept, sections: next });
    };

    return (
        <div className="border border-zinc-800 rounded-xl bg-zinc-950/60 overflow-hidden">
            <div className="flex items-center gap-2 p-3 bg-zinc-900/60 border-b border-zinc-800">
                <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={onMoveUp} className="text-zinc-600 hover:text-zinc-300 text-xs leading-none">▲</button>
                    <button type="button" onClick={onMoveDown} className="text-zinc-600 hover:text-zinc-300 text-xs leading-none">▼</button>
                </div>
                <button type="button" onClick={() => setExpanded(v => !v)} className="text-zinc-400 hover:text-white">
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <span className={`w-3 h-3 rounded-full ${COLOR_SWATCH[dept.color]}`} />
                <Input
                    value={dept.name}
                    onChange={(e) => onChange({ ...dept, name: e.target.value })}
                    placeholder="Sigla (ex: KAM)"
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 h-8 text-sm font-bold w-32"
                />
                <Input
                    value={dept.subtitle}
                    onChange={(e) => onChange({ ...dept, subtitle: e.target.value })}
                    placeholder="Nome completo (ex: Key Account Manager)"
                    className="bg-zinc-950 border-zinc-800 text-zinc-300 h-8 text-sm flex-1"
                />
                <select
                    value={dept.color}
                    onChange={(e) => onChange({ ...dept, color: e.target.value as OrgColor })}
                    className="bg-zinc-950 border border-zinc-800 rounded-md text-zinc-300 text-xs h-8 px-2"
                >
                    {ORG_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 h-8 px-2">
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>

            {expanded && (
                <div className="p-3 space-y-3">
                    {dept.sections.map((s, i) => (
                        <SectionEditor
                            key={s.id}
                            section={s}
                            onChange={(ns) => updateSection(i, ns)}
                            onRemove={() => removeSection(i)}
                            onMoveUp={() => moveSection(i, -1)}
                            onMoveDown={() => moveSection(i, 1)}
                        />
                    ))}
                    <Button type="button" onClick={addSection} variant="outline" className="w-full border-dashed border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900">
                        <Plus className="w-4 h-4 mr-1" /> Adicionar seção
                    </Button>
                </div>
            )}
        </div>
    );
}

function SubdirectorEditor({ sub, onChange, onRemove }: {
    sub: OrgSubdirector;
    onChange: (s: OrgSubdirector) => void;
    onRemove: () => void;
}) {
    const addPerson = () => onChange({ ...sub, people: [...sub.people, { name: 'Novo' }] });
    const updatePerson = (i: number, p: OrgPerson) => onChange({ ...sub, people: sub.people.map((x, idx) => idx === i ? p : x) });
    const removePerson = (i: number) => onChange({ ...sub, people: sub.people.filter((_, idx) => idx !== i) });

    return (
        <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-950/60 space-y-3">
            <div className="flex items-center gap-2">
                <Input
                    value={sub.name}
                    onChange={(e) => onChange({ ...sub, name: e.target.value })}
                    placeholder="Nome (ex: DANI)"
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 h-8 text-sm font-bold flex-1"
                />
                <Input
                    value={sub.subtitle}
                    onChange={(e) => onChange({ ...sub, subtitle: e.target.value })}
                    placeholder="Subtítulo (ex: Maria)"
                    className="bg-zinc-950 border-zinc-800 text-zinc-300 h-8 text-sm flex-1"
                />
                <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 h-8 px-2">
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>
            <div className="pl-2 space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs text-zinc-500">Pessoas no card ({sub.people.length})</Label>
                    <Button type="button" size="sm" variant="ghost" onClick={addPerson} className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 h-7 text-xs">
                        <Plus className="w-3 h-3 mr-1" /> Pessoa
                    </Button>
                </div>
                {sub.people.map((p, i) => (
                    <PersonEditor
                        key={i}
                        person={p}
                        onChange={(np) => updatePerson(i, np)}
                        onRemove={() => removePerson(i)}
                    />
                ))}
            </div>
        </div>
    );
}

export function OrgChartEditor() {
    const [data, setData] = useState<OrgChartData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    useEffect(() => {
        fetchOrgChart().then(d => {
            setData(d);
            setIsLoading(false);
        }).catch(() => setIsLoading(false));
    }, []);

    if (isLoading || !data) {
        return (
            <div className="flex items-center justify-center py-20 text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando organograma...
            </div>
        );
    }

    const updateDept = (i: number, d: OrgDepartment) => setData({ ...data, departments: data.departments.map((x, idx) => idx === i ? d : x) });
    const removeDept = (i: number) => {
        if (!confirm('Remover este departamento inteiro?')) return;
        setData({ ...data, departments: data.departments.filter((_, idx) => idx !== i) });
    };
    const moveDept = (i: number, dir: -1 | 1) => {
        const next = [...data.departments];
        const j = i + dir;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j], next[i]];
        setData({ ...data, departments: next });
    };
    const addDept = () => setData({
        ...data,
        departments: [...data.departments, {
            id: uid('dept'),
            name: 'NOVO',
            subtitle: 'Nova gerência',
            color: 'indigo',
            sections: [],
        }],
    });

    const updateSub = (i: number, s: OrgSubdirector) => setData({ ...data, subdirectors: data.subdirectors.map((x, idx) => idx === i ? s : x) });
    const removeSub = (i: number) => setData({ ...data, subdirectors: data.subdirectors.filter((_, idx) => idx !== i) });
    const addSub = () => setData({
        ...data,
        subdirectors: [...data.subdirectors, { id: uid('sub'), name: 'NOVO', subtitle: '', people: [] }],
    });

    const handleSave = async () => {
        setIsSaving(true);
        setStatus('idle');
        try {
            await saveOrgChart(data);
            setStatus('success');
            setTimeout(() => setStatus('idle'), 3000);
        } catch {
            setStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-4">
                <div>
                    <h1 className="text-2xl font-bold">Organograma DRM</h1>
                    <p className="text-zinc-500">Diretor, sub-diretores, departamentos, seções e pessoas.</p>
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px]">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar Organograma
                </Button>
            </div>

            {status === 'success' && (
                <Alert className="bg-green-500/10 border-green-500/50 text-green-400">
                    <AlertTitle>Salvo!</AlertTitle>
                    <AlertDescription>Organograma persistido no Turso.</AlertDescription>
                </Alert>
            )}
            {status === 'error' && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/50 text-red-500">
                    <AlertTitle>Erro</AlertTitle>
                    <AlertDescription>Falha ao salvar. Tente novamente.</AlertDescription>
                </Alert>
            )}

            {/* Diretor */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-lg font-semibold text-zinc-200">Diretor</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <Label>Nome</Label>
                        <Input value={data.director.name} onChange={(e) => setData({ ...data, director: { ...data.director, name: e.target.value } })} className="bg-zinc-950 border-zinc-800 text-zinc-200" />
                    </div>
                    <div className="space-y-1">
                        <Label>Rótulo (padrão: Diretor)</Label>
                        <Input value={data.director.subtitle ?? ''} onChange={(e) => setData({ ...data, director: { ...data.director, subtitle: e.target.value } })} className="bg-zinc-950 border-zinc-800 text-zinc-200" />
                    </div>
                    <div className="space-y-1">
                        <Label>Versão do organograma</Label>
                        <Input value={data.version} onChange={(e) => setData({ ...data, version: e.target.value })} className="bg-zinc-950 border-zinc-800 text-zinc-200" />
                    </div>
                </div>
            </div>

            {/* Sub-diretores */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-zinc-200">Sub-diretores ({data.subdirectors.length})</h3>
                    <Button type="button" size="sm" onClick={addSub} variant="outline" className="border-zinc-800 text-zinc-300">
                        <Plus className="w-4 h-4 mr-1" /> Adicionar
                    </Button>
                </div>
                <div className="space-y-3">
                    {data.subdirectors.map((s, i) => (
                        <SubdirectorEditor
                            key={s.id}
                            sub={s}
                            onChange={(ns) => updateSub(i, ns)}
                            onRemove={() => removeSub(i)}
                        />
                    ))}
                </div>
            </div>

            {/* Departamentos */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-zinc-200">Departamentos ({data.departments.length})</h3>
                    <Button type="button" size="sm" onClick={addDept} variant="outline" className="border-zinc-800 text-zinc-300">
                        <Plus className="w-4 h-4 mr-1" /> Adicionar departamento
                    </Button>
                </div>
                <div className="space-y-4">
                    {data.departments.map((d, i) => (
                        <DepartmentEditor
                            key={d.id}
                            dept={d}
                            onChange={(nd) => updateDept(i, nd)}
                            onRemove={() => removeDept(i)}
                            onMoveUp={() => moveDept(i, -1)}
                            onMoveDown={() => moveDept(i, 1)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

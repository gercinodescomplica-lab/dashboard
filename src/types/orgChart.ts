export type OrgTag = 'a_confirmar' | 'em_contratacao' | 'a_contratar';

export const ORG_TAG_LABELS: Record<OrgTag, string> = {
    a_confirmar: 'A confirmar',
    em_contratacao: 'Em contratação',
    a_contratar: 'A contratar',
};

export const ORG_TAG_CLASSES: Record<OrgTag, string> = {
    a_confirmar: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    em_contratacao: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    a_contratar: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
};

export type OrgColor = 'indigo' | 'emerald' | 'amber' | 'purple' | 'pink';

export const ORG_COLORS: OrgColor[] = ['indigo', 'emerald', 'amber', 'purple', 'pink'];

export interface OrgPerson {
    name: string;
    tag?: OrgTag;
}

export interface OrgSection {
    id: string;
    name: string;
    isNucleo?: boolean;
    nucleoSubtitle?: string;
    leader?: OrgPerson;
    people: OrgPerson[];
}

export interface OrgDepartment {
    id: string;
    name: string;
    subtitle: string;
    color: OrgColor;
    sections: OrgSection[];
}

export interface OrgSubdirector {
    id: string;
    name: string;
    subtitle: string;
    people: OrgPerson[];
}

export interface OrgChartData {
    director: { name: string; subtitle?: string };
    subdirectors: OrgSubdirector[];
    departments: OrgDepartment[];
    version: string;
}

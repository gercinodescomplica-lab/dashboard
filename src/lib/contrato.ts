// Fonte única de verdade para "este contrato está vigente?" — usada tanto pela
// API externa (/api/external/v1/contracts, /contracts/analytics) quanto pela
// UI interna (ContractsTable: badge, KPI "Vigentes" e categorização do filtro
// dropdown "Situação"). Antes desta função, cada lado tinha sua própria regra
// e podiam divergir — ver achados #3/#5 em
// docs/superpowers/specs/2026-09-04-tdd-infra-e-correcao-bugs-filtros-design.md.
//
// Quando `situacao` (texto livre, editável) está preenchida, ela manda — é o
// que o usuário viu e escreveu por último. `vigente` (o toggle booleano,
// editado independentemente no mesmo modal) só decide quando `situacao` está
// vazia. Essa é a mesma prioridade que a categorização do filtro dropdown já
// usava — a mudança é que agora badge, KPI e API externa seguem ela também.
export function isContratoVigente(contrato: { situacao: string | null; vigente: boolean | null }): boolean {
    if (contrato.situacao) {
        return contrato.situacao.toLowerCase() === 'vigente';
    }
    return contrato.vigente === true;
}

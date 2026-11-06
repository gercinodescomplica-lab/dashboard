'use client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';

interface Props {
    aberto: boolean;
    titulo: string;
    descricao: string;
    rotuloConfirmar: string;
    tom?: 'principal' | 'perigo';
    aoConfirmar: () => void | Promise<void>;
    aoCancelar: () => void;
}

export function ConfirmDialog({ aberto, titulo, descricao, rotuloConfirmar, tom = 'perigo', aoConfirmar, aoCancelar }: Props) {
    return (
        <Dialog open={aberto} onOpenChange={(a) => { if (!a) aoCancelar(); }}>
            <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-50">
                <DialogHeader>
                    <DialogTitle>{titulo}</DialogTitle>
                    <DialogDescription className="text-zinc-400">{descricao}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={aoCancelar}>Cancelar</Button>
                    <Button variant={tom === 'perigo' ? 'destructive' : 'default'} onClick={() => void aoConfirmar()}>{rotuloConfirmar}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

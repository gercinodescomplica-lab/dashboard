import type { Metadata } from 'next';
import { KeyGateGrcc } from './KeyGateGrcc';
import { GrccApp } from './GrccApp';
import { TemaGrccProvider } from './tema';

export const metadata: Metadata = { title: 'GRCC · Leads — AIBertinho' };

export default function GrccPage() {
    return (
        <TemaGrccProvider>
            <KeyGateGrcc>
                <GrccApp />
            </KeyGateGrcc>
        </TemaGrccProvider>
    );
}

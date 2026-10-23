import type { Metadata } from 'next';
import { KeyGateGrcc } from './KeyGateGrcc';
import { GrccApp } from './GrccApp';

export const metadata: Metadata = { title: 'GRCC · Leads — AIBertinho' };

export default function GrccPage() {
    return (
        <KeyGateGrcc>
            <GrccApp />
        </KeyGateGrcc>
    );
}

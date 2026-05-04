import { KeyGateStore } from './KeyGateStore';
import { StorePublicContent } from './StorePublicContent';

export const metadata = {
    title: 'Prodam Store',
};

export default function StorePage() {
    return (
        <div className="min-h-screen bg-zinc-950">
            <KeyGateStore>
                <StorePublicContent />
            </KeyGateStore>
        </div>
    );
}

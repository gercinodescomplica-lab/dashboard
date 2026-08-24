import { CXPlannerGate } from './CXPlannerGate';

export default function CXPlannerPage() {
    return (
        <CXPlannerGate>
            <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center">
                <p className="text-zinc-400">Board de CX em construção.</p>
            </div>
        </CXPlannerGate>
    );
}

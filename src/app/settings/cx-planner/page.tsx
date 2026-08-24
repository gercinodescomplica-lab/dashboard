import { CXPlannerGate } from './CXPlannerGate';
import { CXPlannerBoard } from './CXPlannerBoard';

export default function CXPlannerPage() {
    return (
        <CXPlannerGate>
            <CXPlannerBoard />
        </CXPlannerGate>
    );
}

import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { FrontendGate } from '@/components/FrontendGate';

export default function Home() {
  return (
    <FrontendGate>
      <DashboardShell />
    </FrontendGate>
  );
}

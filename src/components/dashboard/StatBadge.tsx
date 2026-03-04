import { Badge } from '@/components/ui/badge';
import { PerformanceStatus, getStatusColor } from '@/lib/calc';
import { cn } from '@/lib/utils';

interface StatBadgeProps {
    status: PerformanceStatus;
    className?: string;
}

export function StatBadge({ status, className }: StatBadgeProps) {
    return (
        <Badge
            variant="outline"
            className={cn("px-2.5 py-0.5 text-xs font-medium rounded-full", getStatusColor(status), className)}
        >
            {status}
        </Badge>
    );
}

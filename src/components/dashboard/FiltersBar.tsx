import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface FiltersBarProps {
    years: number[];
    selectedYear: string;
    onYearChange: (year: string) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    showCriticalOnly: boolean;
    onShowCriticalOnlyChange: (show: boolean) => void;
}

export function FiltersBar({
    years,
    selectedYear,
    onYearChange,
    searchQuery,
    onSearchChange,
    showCriticalOnly,
    onShowCriticalOnlyChange,
}: FiltersBarProps) {
    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-zinc-950/80 border border-zinc-800/80 rounded-xl shadow-md backdrop-blur-md mb-8">
            <div className="flex flex-1 items-center gap-4 w-full sm:w-auto">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                        type="text"
                        placeholder="Buscar por nome ou cargo..."
                        className="pl-9 bg-zinc-900/50 border-zinc-800 focus-visible:ring-zinc-700"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>

                <div className="w-32">
                    <Select value={selectedYear} onValueChange={onYearChange}>
                        <SelectTrigger className="bg-zinc-900/50 border-zinc-800 focus:ring-zinc-700">
                            <SelectValue placeholder="Ano" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                            {years.map((year) => (
                                <SelectItem key={year} value={year.toString()} className="focus:bg-zinc-800 focus:text-zinc-50">
                                    {year}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
                <Switch
                    id="critical-mode"
                    checked={showCriticalOnly}
                    onCheckedChange={onShowCriticalOnlyChange}
                    className="data-[state=checked]:bg-amber-600"
                />
                <Label htmlFor="critical-mode" className="text-sm font-medium text-zinc-300 cursor-pointer">
                    Mostrar apenas críticos (&lt; 90%)
                </Label>
            </div>
        </div>
    );
}

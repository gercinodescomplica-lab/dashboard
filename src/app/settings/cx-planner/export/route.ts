import { NextRequest } from 'next/server';
import { fetchAllCXItemsForBoard, fetchCXBuckets, fetchCXUsers, fetchManagersList } from '@/db/queries';
import { buildCXPlannerWorkbook, EXPORT_FILENAME } from '@/lib/cx-planner-export';
import { filterCXBoardItems, cxFilterParamsFromSearch } from '../cx-filter';

export async function GET(request: NextRequest) {
    const sp = request.nextUrl.searchParams;
    const key = sp.get('key');
    const correctKey = process.env.CX_PLANNER_KEY || 'prodam_cx_2026';
    if (key !== correctKey) {
        return new Response('Não autorizado.', { status: 401 });
    }

    const [allItems, buckets, users, managers] = await Promise.all([
        fetchAllCXItemsForBoard(),
        fetchCXBuckets(),
        fetchCXUsers(),
        fetchManagersList(),
    ]);

    // Sem parâmetros de filtro na URL => planilha completa; com filtro =>
    // exatamente o que está visível no board (mesma função de predicado).
    const items = filterCXBoardItems(allItems, cxFilterParamsFromSearch(sp));

    const wb = buildCXPlannerWorkbook({
        items,
        buckets,
        users,
        managers: managers.map((m) => ({ id: m.id, name: m.name, role: m.role })),
    });

    const buffer = await wb.xlsx.writeBuffer();

    return new Response(buffer as ArrayBuffer, {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${EXPORT_FILENAME}"`,
            'Cache-Control': 'no-store',
        },
    });
}

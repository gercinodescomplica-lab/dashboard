import { NextResponse } from 'next/server';
import { fetchFullDashboardData } from '@/db/queries';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing or invalid Authorization header' },
      { status: 401 }
    );
  }

  const token = authHeader.split(' ')[1];
  const apiKey = process.env.EXTERNAL_API_KEY;

  if (!apiKey || token !== apiKey) {
    return NextResponse.json(
      { error: 'Invalid Bearer Token' },
      { status: 403 }
    );
  }

  try {
    const managersRaw = await fetchFullDashboardData();
    
    // Calculate DRM Totals
    const summary = {
      totalManagers: managersRaw.length,
      totalMeta: managersRaw.reduce((acc, m) => acc + (m.meta || 0), 0),
      totalContratado: managersRaw.reduce((acc, m) => acc + (m.contratado || 0), 0),
      totalForecast: managersRaw.reduce((acc, m) => acc + (m.forecastFinal || 0), 0),
      totalVisits: managersRaw.reduce((acc, m) => acc + (m.visits?.length || 0), 0),
      totalCXItems: managersRaw.reduce((acc, m) => acc + (m.cx?.length || 0), 0),
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
      data: managersRaw,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

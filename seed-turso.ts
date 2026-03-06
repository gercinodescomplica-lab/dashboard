import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/libsql';
import fs from 'fs';
import path from 'path';

// Load env vars
config({ path: '.env' }); // Make sure you have this config
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
    console.error('Missing TURSO variables. DB seeding skipped.');
    process.exit(1);
}

const db = drizzle({ connection: { url, authToken } });
import { managers, projects } from './src/db/schema';
import { Manager } from './src/types/manager';

async function seed() {
    console.log('🌱 Starting database seeding from JSON...');

    const managersPath = path.join(process.cwd(), 'src', 'mock', 'managers.json');
    const managersData: Manager[] = JSON.parse(fs.readFileSync(managersPath, 'utf8'));

    for (const manager of managersData) {
        console.log(`- Inserting Manager: ${manager.name}`);

        // Insert Manager details
        await db.insert(managers).values({
            id: manager.id,
            name: manager.name,
            role: manager.role,
            avatarUrl: manager.avatarUrl,
            year: manager.year,
            meta: manager.meta,
            contratado: manager.contratado,
            forecastFinal: manager.forecastFinal,
            notes: manager.notes || null,
        }).onConflictDoNothing(); // Prevent duplicate constraints

        // Process Quarters (q1, q2, q3, q4)
        for (const [quarterId, quarterData] of Object.entries(manager.pipeline)) {
            for (const project of quarterData.projects) {
                await db.insert(projects).values({
                    managerId: manager.id,
                    quarter: quarterId as 'q1' | 'q2' | 'q3' | 'q4',
                    orgao: project.orgao || null,
                    name: project.name,
                    value: project.value,
                    temperature: project.temperature as any || null,
                });
            }
        }
    }

    console.log('✅ Base de dados popualda com sucesso com o JSON do Frontend!');
    process.exit(0);
}

seed().catch((err) => {
    console.error('Failed to seed:', err);
    process.exit(1);
});

import { drizzle } from 'drizzle-orm/libsql';

// Next.js (local) and Vercel (production) inject process.env automatically.
// DO NOT use dotenv here - it tries to read a file that doesn't exist on Vercel servers.
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
    throw new Error('TURSO_DATABASE_URL is missing. Please set it in your environment variable.');
}

export const db = drizzle({ connection: { url, authToken } });

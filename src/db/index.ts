import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/libsql';

config({ path: '.env' }); // or .env

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
    throw new Error('TURSO_DATABASE_URL is missing. Please set it in your environment variable.');
}

export const db = drizzle({ connection: { url, authToken } });

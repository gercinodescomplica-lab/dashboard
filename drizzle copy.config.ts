import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';
config({ path: '.env' });

if (!process.env.TURSO_DATABASE_URL) {
    throw new Error('TURSO_DATABASE_URL is missing');
}

export default defineConfig({
    dialect: 'turso',
    schema: './src/db/schema.ts',
    out: './src/db/migrations',
    dbCredentials: {
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    },
});

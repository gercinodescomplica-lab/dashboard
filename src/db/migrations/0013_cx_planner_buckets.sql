CREATE TABLE IF NOT EXISTS cx_buckets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    position INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cx_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT
);
--> statement-breakpoint
ALTER TABLE cx ADD COLUMN bucket_id INTEGER REFERENCES cx_buckets(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE cx ADD COLUMN responsavel_id INTEGER REFERENCES cx_users(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE cx ADD COLUMN subtitulo TEXT;

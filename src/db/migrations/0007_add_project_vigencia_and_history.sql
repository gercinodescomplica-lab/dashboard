ALTER TABLE projects ADD COLUMN duration_months INTEGER DEFAULT 12;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN start_date TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN history TEXT;

-- Make image_url nullable to allow voice-only progress updates
ALTER TABLE work_logs ALTER COLUMN image_url DROP NOT NULL;
-- Add photo_date column to drawings table to store the actual photo creation date from EXIF
ALTER TABLE drawings ADD COLUMN photo_date timestamp with time zone;

-- Update existing drawings to use created_at as photo_date if not set
UPDATE drawings SET photo_date = created_at WHERE photo_date IS NULL;
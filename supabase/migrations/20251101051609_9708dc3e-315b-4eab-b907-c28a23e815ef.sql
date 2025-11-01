-- Add thumbnail_url column to drawings table
ALTER TABLE drawings ADD COLUMN thumbnail_url text;

COMMENT ON COLUMN drawings.thumbnail_url IS 'URL of the thumbnail image for faster gallery loading';
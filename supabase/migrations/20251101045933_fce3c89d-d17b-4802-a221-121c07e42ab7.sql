-- Update existing drawings without photo_date to use created_at
UPDATE drawings 
SET photo_date = created_at 
WHERE photo_date IS NULL;
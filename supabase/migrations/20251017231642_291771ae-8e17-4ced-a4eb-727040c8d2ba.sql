-- Create storage bucket for child photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('child-photos', 'child-photos', true);

-- Create storage policies for child photos
CREATE POLICY "Users can upload their own child photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'child-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own child photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'child-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own child photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'child-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own child photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'child-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add photo_url column to children table and rename photo_emoji
ALTER TABLE public.children 
ADD COLUMN photo_url text;

-- Update existing records to use default photo
UPDATE public.children 
SET photo_url = NULL 
WHERE photo_emoji IS NOT NULL;
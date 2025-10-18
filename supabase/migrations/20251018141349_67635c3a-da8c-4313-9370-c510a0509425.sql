-- Make child-photos bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'child-photos';
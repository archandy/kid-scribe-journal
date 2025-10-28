-- Make child-photos bucket public so photos can be displayed
UPDATE storage.buckets 
SET public = true 
WHERE name = 'child-photos';

-- Allow family members to view each other's profiles
CREATE POLICY "Family members can view each other's profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.family_members fm1
    JOIN public.family_members fm2 ON fm1.family_id = fm2.family_id
    WHERE fm1.user_id = auth.uid()
    AND fm2.user_id = profiles.id
  )
);
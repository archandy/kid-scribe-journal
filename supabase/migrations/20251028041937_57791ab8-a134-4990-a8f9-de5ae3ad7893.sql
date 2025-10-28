-- Add avatar_url to profiles table for profile pictures
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add label column to family_members for relationship labels (Mom, Dad, etc.)
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS label TEXT;
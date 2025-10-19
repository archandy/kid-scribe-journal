-- Add tags column to notes table for AI-generated behavioral hashtags
ALTER TABLE public.notes ADD COLUMN tags TEXT[];
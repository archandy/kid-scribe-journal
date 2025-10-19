-- Add language preference column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN language text DEFAULT 'en' CHECK (language IN ('en', 'ja', 'ko'));
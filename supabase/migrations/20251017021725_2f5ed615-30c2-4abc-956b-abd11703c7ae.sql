-- Fix the search path for the function to make it secure (without dropping)
CREATE OR REPLACE FUNCTION public.update_notion_tokens_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
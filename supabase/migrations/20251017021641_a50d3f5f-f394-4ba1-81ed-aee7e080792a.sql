-- Create table to store Notion OAuth tokens per user
CREATE TABLE IF NOT EXISTS public.notion_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  workspace_id TEXT,
  workspace_name TEXT,
  database_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.notion_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only view/update their own tokens
CREATE POLICY "Users can view their own tokens"
  ON public.notion_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
  ON public.notion_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
  ON public.notion_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_notion_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_notion_tokens_updated_at
  BEFORE UPDATE ON public.notion_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notion_tokens_updated_at();
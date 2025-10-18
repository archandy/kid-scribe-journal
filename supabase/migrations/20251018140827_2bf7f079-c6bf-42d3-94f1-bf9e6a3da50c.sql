-- Create table for OAuth state tokens to prevent CSRF attacks
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  state_token text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '10 minutes')
);

-- Enable RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Users can only access their own state tokens
CREATE POLICY "Users can view their own oauth states"
ON public.oauth_states
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own oauth states"
ON public.oauth_states
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Service role can delete expired tokens for cleanup
CREATE POLICY "Service role can delete expired tokens"
ON public.oauth_states
FOR DELETE
TO service_role
USING (expires_at < now());

-- Create index for performance
CREATE INDEX idx_oauth_states_token ON public.oauth_states(state_token);
CREATE INDEX idx_oauth_states_expires ON public.oauth_states(expires_at);

-- Function to clean up expired state tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.oauth_states
  WHERE expires_at < now();
END;
$$;
-- Restrict access_token column from client queries
-- This prevents Notion access tokens from being exposed to the client
-- while still allowing users to check their connection status

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.notion_tokens;

-- Create a new restricted SELECT policy
CREATE POLICY "Users can check connection status"
ON public.notion_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Revoke direct access to the access_token column from authenticated users
REVOKE SELECT (access_token) ON public.notion_tokens FROM authenticated;

-- Grant access to only the safe columns
GRANT SELECT (id, user_id, workspace_id, workspace_name, database_id, created_at, updated_at) 
ON public.notion_tokens TO authenticated;
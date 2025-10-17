-- Add DELETE policy for notion_tokens table
CREATE POLICY "Users can delete their own tokens"
ON notion_tokens
FOR DELETE
USING (auth.uid() = user_id);
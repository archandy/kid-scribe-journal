-- Create table for storing drawing analyses
CREATE TABLE public.drawing_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id),
  child_id UUID NOT NULL REFERENCES public.children(id),
  analysis JSONB NOT NULL,
  drawing_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.drawing_analyses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Family members can view analyses"
ON public.drawing_analyses
FOR SELECT
USING (is_family_member(auth.uid(), family_id));

CREATE POLICY "Family members can insert analyses"
ON public.drawing_analyses
FOR INSERT
WITH CHECK (is_family_member(auth.uid(), family_id));

CREATE POLICY "Family members can delete analyses"
ON public.drawing_analyses
FOR DELETE
USING (is_family_member(auth.uid(), family_id));
-- Create storage bucket for drawings
INSERT INTO storage.buckets (id, name, public)
VALUES ('drawings', 'drawings', true);

-- Create drawings table
CREATE TABLE public.drawings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  title TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.drawings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for drawings table
CREATE POLICY "Family members can view drawings"
  ON public.drawings
  FOR SELECT
  USING (is_family_member(auth.uid(), family_id));

CREATE POLICY "Family members can insert drawings"
  ON public.drawings
  FOR INSERT
  WITH CHECK (is_family_member(auth.uid(), family_id));

CREATE POLICY "Family members can delete drawings"
  ON public.drawings
  FOR DELETE
  USING (is_family_member(auth.uid(), family_id));

-- Storage policies for drawings bucket
CREATE POLICY "Family members can view drawings"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'drawings' AND auth.uid() IS NOT NULL);

CREATE POLICY "Family members can upload drawings"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'drawings' AND auth.uid() IS NOT NULL);

CREATE POLICY "Family members can delete drawings"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'drawings' AND auth.uid() IS NOT NULL);
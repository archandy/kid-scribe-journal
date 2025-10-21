-- Create enum types
CREATE TYPE public.family_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

-- Create families table
CREATE TABLE public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on families
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- Create family_members table
CREATE TABLE public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.family_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(family_id, user_id)
);

-- Enable RLS on family_members
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- Create family_invitations table
CREATE TABLE public.family_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

-- Enable RLS on family_invitations
ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;

-- Add family_id to children table
ALTER TABLE public.children ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;

-- Add family_id to notes table
ALTER TABLE public.notes ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;

-- Migrate existing data: Create a family for each existing user
DO $$
DECLARE
  user_record RECORD;
  new_family_id UUID;
BEGIN
  FOR user_record IN SELECT DISTINCT user_id FROM public.children
  LOOP
    -- Create family
    INSERT INTO public.families (name) VALUES ('Family') RETURNING id INTO new_family_id;
    
    -- Add user as owner
    INSERT INTO public.family_members (family_id, user_id, role) VALUES (new_family_id, user_record.user_id, 'owner');
    
    -- Update children
    UPDATE public.children SET family_id = new_family_id WHERE user_id = user_record.user_id;
    
    -- Update notes
    UPDATE public.notes SET family_id = new_family_id WHERE user_id = user_record.user_id;
  END LOOP;
END $$;

-- Make family_id NOT NULL after migration
ALTER TABLE public.children ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE public.notes ALTER COLUMN family_id SET NOT NULL;

-- RLS Policies for families
CREATE POLICY "Users can view their own family" ON public.families
  FOR SELECT USING (
    id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their own family" ON public.families
  FOR UPDATE USING (
    id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- RLS Policies for family_members
CREATE POLICY "Users can view their family members" ON public.family_members
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "System can insert family members" ON public.family_members
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Owners and admins can update members" ON public.family_members
  FOR UPDATE USING (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Owners and admins can delete members" ON public.family_members
  FOR DELETE USING (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    AND user_id != auth.uid()
  );

-- RLS Policies for family_invitations
CREATE POLICY "Users can view invitations for their family" ON public.family_invitations
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Owners and admins can create invitations" ON public.family_invitations
  FOR INSERT WITH CHECK (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Owners and admins can update invitations" ON public.family_invitations
  FOR UPDATE USING (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Update RLS policies for children to use family_id
DROP POLICY IF EXISTS "Users can view their own children" ON public.children;
DROP POLICY IF EXISTS "Users can insert their own children" ON public.children;
DROP POLICY IF EXISTS "Users can update their own children" ON public.children;
DROP POLICY IF EXISTS "Users can delete their own children" ON public.children;

CREATE POLICY "Family members can view children" ON public.children
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Family members can insert children" ON public.children
  FOR INSERT WITH CHECK (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Family members can update children" ON public.children
  FOR UPDATE USING (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Family members can delete children" ON public.children
  FOR DELETE USING (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );

-- Update RLS policies for notes to use family_id
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can insert their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;

CREATE POLICY "Family members can view notes" ON public.notes
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Family members can insert notes" ON public.notes
  FOR INSERT WITH CHECK (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Family members can update notes" ON public.notes
  FOR UPDATE USING (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Family members can delete notes" ON public.notes
  FOR DELETE USING (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );

-- Create trigger to auto-create family for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_family()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_family_id UUID;
BEGIN
  -- Create a new family
  INSERT INTO public.families (name) VALUES ('My Family') RETURNING id INTO new_family_id;
  
  -- Add user as owner
  INSERT INTO public.family_members (family_id, user_id, role) VALUES (new_family_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_family
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_family();
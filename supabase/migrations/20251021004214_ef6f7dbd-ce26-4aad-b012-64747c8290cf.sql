-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their family members" ON public.family_members;
DROP POLICY IF EXISTS "Owners and admins can update members" ON public.family_members;
DROP POLICY IF EXISTS "Owners and admins can delete members" ON public.family_members;
DROP POLICY IF EXISTS "Users can view their own family" ON public.families;
DROP POLICY IF EXISTS "Users can update their own family" ON public.families;
DROP POLICY IF EXISTS "Users can view invitations for their family" ON public.family_invitations;
DROP POLICY IF EXISTS "Owners and admins can create invitations" ON public.family_invitations;
DROP POLICY IF EXISTS "Owners and admins can update invitations" ON public.family_invitations;
DROP POLICY IF EXISTS "Family members can view children" ON public.children;
DROP POLICY IF EXISTS "Family members can insert children" ON public.children;
DROP POLICY IF EXISTS "Family members can update children" ON public.children;
DROP POLICY IF EXISTS "Family members can delete children" ON public.children;
DROP POLICY IF EXISTS "Family members can view notes" ON public.notes;
DROP POLICY IF EXISTS "Family members can insert notes" ON public.notes;
DROP POLICY IF EXISTS "Family members can update notes" ON public.notes;
DROP POLICY IF EXISTS "Family members can delete notes" ON public.notes;

-- Create security definer function to get user's family_id
CREATE OR REPLACE FUNCTION public.get_user_family_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM public.family_members WHERE user_id = _user_id LIMIT 1;
$$;

-- Create security definer function to check if user is family owner/admin
CREATE OR REPLACE FUNCTION public.is_family_admin(_user_id UUID, _family_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members 
    WHERE user_id = _user_id 
    AND family_id = _family_id 
    AND role IN ('owner', 'admin')
  );
$$;

-- Create security definer function to check if user is in family
CREATE OR REPLACE FUNCTION public.is_family_member(_user_id UUID, _family_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members 
    WHERE user_id = _user_id 
    AND family_id = _family_id
  );
$$;

-- RLS Policies for families
CREATE POLICY "Users can view their own family" ON public.families
  FOR SELECT USING (
    id = public.get_user_family_id(auth.uid())
  );

CREATE POLICY "Admins can update their family" ON public.families
  FOR UPDATE USING (
    public.is_family_admin(auth.uid(), id)
  );

-- RLS Policies for family_members
CREATE POLICY "Users can view their family members" ON public.family_members
  FOR SELECT USING (
    family_id = public.get_user_family_id(auth.uid())
  );

CREATE POLICY "Admins can update members" ON public.family_members
  FOR UPDATE USING (
    public.is_family_admin(auth.uid(), family_id)
  );

CREATE POLICY "Admins can delete members" ON public.family_members
  FOR DELETE USING (
    public.is_family_admin(auth.uid(), family_id)
    AND user_id != auth.uid()
  );

-- RLS Policies for family_invitations
CREATE POLICY "Users can view invitations for their family" ON public.family_invitations
  FOR SELECT USING (
    family_id = public.get_user_family_id(auth.uid())
  );

CREATE POLICY "Admins can create invitations" ON public.family_invitations
  FOR INSERT WITH CHECK (
    public.is_family_admin(auth.uid(), family_id)
  );

CREATE POLICY "Admins can update invitations" ON public.family_invitations
  FOR UPDATE USING (
    public.is_family_admin(auth.uid(), family_id)
  );

-- RLS Policies for children
CREATE POLICY "Family members can view children" ON public.children
  FOR SELECT USING (
    public.is_family_member(auth.uid(), family_id)
  );

CREATE POLICY "Family members can insert children" ON public.children
  FOR INSERT WITH CHECK (
    public.is_family_member(auth.uid(), family_id)
  );

CREATE POLICY "Family members can update children" ON public.children
  FOR UPDATE USING (
    public.is_family_member(auth.uid(), family_id)
  );

CREATE POLICY "Family members can delete children" ON public.children
  FOR DELETE USING (
    public.is_family_member(auth.uid(), family_id)
  );

-- RLS Policies for notes
CREATE POLICY "Family members can view notes" ON public.notes
  FOR SELECT USING (
    public.is_family_member(auth.uid(), family_id)
  );

CREATE POLICY "Family members can insert notes" ON public.notes
  FOR INSERT WITH CHECK (
    public.is_family_member(auth.uid(), family_id)
  );

CREATE POLICY "Family members can update notes" ON public.notes
  FOR UPDATE USING (
    public.is_family_member(auth.uid(), family_id)
  );

CREATE POLICY "Family members can delete notes" ON public.notes
  FOR DELETE USING (
    public.is_family_member(auth.uid(), family_id)
  );
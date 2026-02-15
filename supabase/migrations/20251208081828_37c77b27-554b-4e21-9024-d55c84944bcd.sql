-- Create security definer helper functions to avoid RLS recursion

-- Check if user is member of a team
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_memberships
    WHERE user_id = _user_id 
      AND team_id = _team_id
      AND status = 'active'
  )
$$;

-- Check if user is captain of a team
CREATE OR REPLACE FUNCTION public.is_team_captain(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_memberships
    WHERE user_id = _user_id 
      AND team_id = _team_id
      AND role = 'captain'
      AND status = 'active'
  )
$$;

-- Get all team IDs for a user
CREATE OR REPLACE FUNCTION public.get_user_team_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.team_memberships
  WHERE user_id = _user_id AND status = 'active'
$$;

-- Drop existing recursive policies on team_memberships
DROP POLICY IF EXISTS "Users can view memberships of their teams" ON public.team_memberships;
DROP POLICY IF EXISTS "Captains can manage team memberships" ON public.team_memberships;
DROP POLICY IF EXISTS "Captains can update team memberships" ON public.team_memberships;

-- Create new non-recursive policies for team_memberships
CREATE POLICY "Users can view team memberships"
ON public.team_memberships FOR SELECT
USING (
  user_id = auth.uid() 
  OR team_id IN (SELECT public.get_user_team_ids(auth.uid()))
);

CREATE POLICY "Manage team memberships"
ON public.team_memberships FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR public.is_team_captain(auth.uid(), team_id)
);

CREATE POLICY "Captains can update memberships"
ON public.team_memberships FOR UPDATE
USING (
  public.is_team_captain(auth.uid(), team_id)
);

-- Update teams table policies to use helper functions
DROP POLICY IF EXISTS "Team members can view their teams" ON public.teams;
DROP POLICY IF EXISTS "Captains can update their teams" ON public.teams;

CREATE POLICY "Team members can view their teams"
ON public.teams FOR SELECT
USING (id IN (SELECT public.get_user_team_ids(auth.uid())));

CREATE POLICY "Captains can update their teams"
ON public.teams FOR UPDATE
USING (public.is_team_captain(auth.uid(), id));

-- Update tasks table policies to use helper functions
DROP POLICY IF EXISTS "Team members can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Team members can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Task creators and captains can update tasks" ON public.tasks;

CREATE POLICY "Team members can view tasks"
ON public.tasks FOR SELECT
USING (
  team_id IS NULL 
  OR public.is_team_member(auth.uid(), team_id)
);

CREATE POLICY "Users can create tasks"
ON public.tasks FOR INSERT
WITH CHECK (
  team_id IS NULL 
  OR public.is_team_member(auth.uid(), team_id)
);

CREATE POLICY "Task creators and captains can update tasks"
ON public.tasks FOR UPDATE
USING (
  created_by_user_id = auth.uid() 
  OR (team_id IS NOT NULL AND public.is_team_captain(auth.uid(), team_id))
);
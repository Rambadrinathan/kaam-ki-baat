-- Add RLS policy for admin to view all daily_scores
CREATE POLICY "Admins can view all daily scores"
ON public.daily_scores
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add RLS policy for admin to view all work_logs
CREATE POLICY "Admins can view all work logs"
ON public.work_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add RLS policy for admin to view all tasks
CREATE POLICY "Admins can view all tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add RLS policy for admin to view all task_assignments
CREATE POLICY "Admins can view all task assignments"
ON public.task_assignments
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add RLS policy for admin to view all teams
CREATE POLICY "Admins can view all teams"
ON public.teams
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add RLS policy for admin to view all team_memberships
CREATE POLICY "Admins can view all team memberships"
ON public.team_memberships
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
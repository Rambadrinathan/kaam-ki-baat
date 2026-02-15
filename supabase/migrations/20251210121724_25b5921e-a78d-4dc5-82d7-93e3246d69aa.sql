-- Add policy allowing team creators to view their created teams
-- This fixes the chicken-and-egg problem where creators couldn't see their team
-- immediately after creation (before membership was added)
CREATE POLICY "Creators can view their teams"
  ON public.teams
  FOR SELECT
  USING (auth.uid() = created_by_user_id);
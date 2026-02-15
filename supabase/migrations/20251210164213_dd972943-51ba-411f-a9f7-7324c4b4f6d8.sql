-- New table for storing invitations by phone number
CREATE TABLE public.pending_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  role team_membership_role NOT NULL DEFAULT 'member',
  invited_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one invitation per phone per team
ALTER TABLE public.pending_invitations 
  ADD CONSTRAINT unique_team_phone UNIQUE (team_id, phone);

-- Enable RLS
ALTER TABLE public.pending_invitations ENABLE ROW LEVEL SECURITY;

-- Captains can manage invitations for their teams
CREATE POLICY "Captains can manage invitations"
  ON public.pending_invitations
  FOR ALL
  USING (is_team_captain(auth.uid(), team_id));

-- Allow authenticated users to check invitations by phone (for signup flow)
CREATE POLICY "Authenticated users can view invitations"
  ON public.pending_invitations
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
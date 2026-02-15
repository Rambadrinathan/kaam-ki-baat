-- Make team_id nullable so workers can submit plans without being in a team
ALTER TABLE public.tasks ALTER COLUMN team_id DROP NOT NULL;
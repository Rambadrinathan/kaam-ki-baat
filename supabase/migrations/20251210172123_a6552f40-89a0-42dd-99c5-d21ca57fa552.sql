-- Add invite_code column to teams table
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- Create function to generate unique invite code
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := '';
    i INTEGER;
    code_exists BOOLEAN;
BEGIN
    LOOP
        result := '';
        FOR i IN 1..6 LOOP
            result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
        END LOOP;
        
        SELECT EXISTS(SELECT 1 FROM public.teams WHERE invite_code = result) INTO code_exists;
        
        IF NOT code_exists THEN
            RETURN result;
        END IF;
    END LOOP;
END;
$$;

-- Generate invite codes for existing teams that don't have one
UPDATE public.teams 
SET invite_code = public.generate_invite_code() 
WHERE invite_code IS NULL;

-- Create trigger to auto-generate invite code on team creation
CREATE OR REPLACE FUNCTION public.set_invite_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.invite_code IS NULL THEN
        NEW.invite_code := public.generate_invite_code();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_team_invite_code ON public.teams;
CREATE TRIGGER set_team_invite_code
    BEFORE INSERT ON public.teams
    FOR EACH ROW
    EXECUTE FUNCTION public.set_invite_code();
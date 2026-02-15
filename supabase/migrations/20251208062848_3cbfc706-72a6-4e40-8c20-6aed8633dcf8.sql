-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'captain', 'worker');

-- Create user_roles table (security best practice - roles separate from profiles)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents recursive RLS issues)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    preferred_language TEXT DEFAULT 'hi',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create teams table
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    full_score_value NUMERIC NOT NULL DEFAULT 500,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Create team_membership_role enum
CREATE TYPE public.team_membership_role AS ENUM ('captain', 'vice_captain', 'member');
CREATE TYPE public.team_membership_status AS ENUM ('active', 'inactive');

-- Create team_memberships table
CREATE TABLE public.team_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role team_membership_role NOT NULL DEFAULT 'member',
    status team_membership_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (team_id, user_id)
);

-- Enable RLS on team_memberships
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;

-- Create task_type enum
CREATE TYPE public.task_type AS ENUM ('captain_assigned', 'self_proposed');
CREATE TYPE public.task_status AS ENUM ('open', 'pending_approval', 'assigned', 'in_progress', 'completed', 'cancelled', 'rejected');

-- Create tasks table
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type task_type NOT NULL,
    title TEXT NOT NULL,
    description_text TEXT,
    voice_note_url TEXT,
    image_url TEXT,
    estimated_slots INTEGER NOT NULL DEFAULT 1 CHECK (estimated_slots >= 1 AND estimated_slots <= 4),
    scheduled_date DATE NOT NULL,
    status task_status NOT NULL DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create task_assignment_status enum
CREATE TYPE public.task_assignment_status AS ENUM ('pending', 'accepted', 'in_progress', 'completed', 'cancelled');

-- Create task_assignments table
CREATE TABLE public.task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    status task_assignment_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on task_assignments
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

-- Create work_logs table
CREATE TABLE public.work_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_assignment_id UUID REFERENCES public.task_assignments(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT NOT NULL,
    voice_note_url TEXT,
    note_text TEXT,
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on work_logs
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;

-- Create daily_scores table
CREATE TABLE public.daily_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_assignment_id UUID REFERENCES public.task_assignments(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    auto_score INTEGER CHECK (auto_score >= 0 AND auto_score <= 10),
    final_score INTEGER CHECK (final_score >= 0 AND final_score <= 10),
    summary_text TEXT,
    ai_analysis TEXT,
    validated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    validation_timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (task_assignment_id, date)
);

-- Enable RLS on daily_scores
ALTER TABLE public.daily_scores ENABLE ROW LEVEL SECURITY;

-- Create earning_status enum
CREATE TYPE public.earning_status AS ENUM ('pending', 'calculated', 'exported');

-- Create earnings table
CREATE TABLE public.earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
    amount NUMERIC NOT NULL,
    status earning_status NOT NULL DEFAULT 'pending',
    daily_score_id UUID REFERENCES public.daily_scores(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on earnings
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_team_memberships_updated_at BEFORE UPDATE ON public.team_memberships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_task_assignments_updated_at BEFORE UPDATE ON public.task_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_work_logs_updated_at BEFORE UPDATE ON public.work_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_daily_scores_updated_at BEFORE UPDATE ON public.daily_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_earnings_updated_at BEFORE UPDATE ON public.earnings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- User roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Teams policies
CREATE POLICY "Team members can view their teams" ON public.teams FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.team_memberships WHERE team_id = teams.id AND user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Captains can create teams" ON public.teams FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by_user_id);
CREATE POLICY "Captains can update their teams" ON public.teams FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.team_memberships WHERE team_id = teams.id AND user_id = auth.uid() AND role = 'captain' AND status = 'active'));

-- Team memberships policies
CREATE POLICY "Users can view memberships of their teams" ON public.team_memberships FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.team_memberships tm WHERE tm.team_id = team_memberships.team_id AND tm.user_id = auth.uid() AND tm.status = 'active'));
CREATE POLICY "Captains can manage team memberships" ON public.team_memberships FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.team_memberships tm WHERE tm.team_id = team_memberships.team_id AND tm.user_id = auth.uid() AND tm.role = 'captain' AND tm.status = 'active') OR auth.uid() = user_id);
CREATE POLICY "Captains can update team memberships" ON public.team_memberships FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.team_memberships tm WHERE tm.team_id = team_memberships.team_id AND tm.user_id = auth.uid() AND tm.role = 'captain' AND tm.status = 'active'));

-- Tasks policies
CREATE POLICY "Team members can view tasks" ON public.tasks FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.team_memberships WHERE team_id = tasks.team_id AND user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Team members can create tasks" ON public.tasks FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.team_memberships WHERE team_id = tasks.team_id AND user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Task creators and captains can update tasks" ON public.tasks FOR UPDATE TO authenticated 
USING (created_by_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.team_memberships WHERE team_id = tasks.team_id AND user_id = auth.uid() AND role = 'captain' AND status = 'active'));

-- Task assignments policies
CREATE POLICY "Users can view their assignments" ON public.task_assignments FOR SELECT TO authenticated 
USING (assigned_to_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.tasks t JOIN public.team_memberships tm ON t.team_id = tm.team_id WHERE t.id = task_assignments.task_id AND tm.user_id = auth.uid() AND tm.role = 'captain' AND tm.status = 'active'));
CREATE POLICY "Users can create their own assignments" ON public.task_assignments FOR INSERT TO authenticated 
WITH CHECK (assigned_to_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.tasks t JOIN public.team_memberships tm ON t.team_id = tm.team_id WHERE t.id = task_assignments.task_id AND tm.user_id = auth.uid() AND tm.role = 'captain' AND tm.status = 'active'));
CREATE POLICY "Users can update their own assignments" ON public.task_assignments FOR UPDATE TO authenticated 
USING (assigned_to_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.tasks t JOIN public.team_memberships tm ON t.team_id = tm.team_id WHERE t.id = task_assignments.task_id AND tm.user_id = auth.uid() AND tm.role = 'captain' AND tm.status = 'active'));

-- Work logs policies
CREATE POLICY "Users can view work logs for their assignments" ON public.work_logs FOR SELECT TO authenticated 
USING (created_by_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.task_assignments ta JOIN public.tasks t ON ta.task_id = t.id JOIN public.team_memberships tm ON t.team_id = tm.team_id WHERE ta.id = work_logs.task_assignment_id AND tm.user_id = auth.uid() AND tm.role = 'captain' AND tm.status = 'active'));
CREATE POLICY "Users can create work logs for their assignments" ON public.work_logs FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.task_assignments WHERE id = work_logs.task_assignment_id AND assigned_to_user_id = auth.uid()));

-- Daily scores policies
CREATE POLICY "Users can view their own scores" ON public.daily_scores FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.task_assignments WHERE id = daily_scores.task_assignment_id AND assigned_to_user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.task_assignments ta JOIN public.tasks t ON ta.task_id = t.id JOIN public.team_memberships tm ON t.team_id = tm.team_id WHERE ta.id = daily_scores.task_assignment_id AND tm.user_id = auth.uid() AND tm.role = 'captain' AND tm.status = 'active'));
CREATE POLICY "Captains can manage daily scores" ON public.daily_scores FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.task_assignments ta JOIN public.tasks t ON ta.task_id = t.id JOIN public.team_memberships tm ON t.team_id = tm.team_id WHERE ta.id = daily_scores.task_assignment_id AND tm.user_id = auth.uid() AND tm.status = 'active'));
CREATE POLICY "Captains can update daily scores" ON public.daily_scores FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.task_assignments ta JOIN public.tasks t ON ta.task_id = t.id JOIN public.team_memberships tm ON t.team_id = tm.team_id WHERE ta.id = daily_scores.task_assignment_id AND tm.user_id = auth.uid() AND tm.role = 'captain' AND tm.status = 'active'));

-- Earnings policies
CREATE POLICY "Users can view their own earnings" ON public.earnings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Captains can view team earnings" ON public.earnings FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.team_memberships WHERE team_id = earnings.team_id AND user_id = auth.uid() AND role = 'captain' AND status = 'active'));
CREATE POLICY "System can create earnings" ON public.earnings FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.team_memberships WHERE team_id = earnings.team_id AND user_id = auth.uid() AND role = 'captain' AND status = 'active'));

-- Create storage bucket for uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('work-uploads', 'work-uploads', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'work-uploads');
CREATE POLICY "Anyone can view uploads" ON storage.objects FOR SELECT USING (bucket_id = 'work-uploads');
CREATE POLICY "Users can update their own uploads" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'work-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own uploads" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'work-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
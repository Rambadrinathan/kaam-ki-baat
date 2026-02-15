-- Create error_tracking table
CREATE TABLE public.error_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    error_type TEXT NOT NULL CHECK (error_type IN ('client', 'server', 'edge_function', 'database')),
    error_code TEXT,
    message TEXT NOT NULL,
    stack_trace TEXT,
    page_url TEXT,
    user_agent TEXT,
    metadata JSONB,
    severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('warning', 'error', 'critical')),
    resolved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create activity_logs table
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.error_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Error tracking RLS policies
CREATE POLICY "Users can insert their own errors"
ON public.error_tracking
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Admins can view all errors"
ON public.error_tracking
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update errors"
ON public.error_tracking
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Activity logs RLS policies
CREATE POLICY "Users can view their own activity"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own activity"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all activity"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Captains can view team member activity"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.team_memberships tm1
        JOIN public.team_memberships tm2 ON tm1.team_id = tm2.team_id
        WHERE tm1.user_id = auth.uid()
        AND tm1.role = 'captain'
        AND tm1.status = 'active'
        AND tm2.user_id = activity_logs.user_id
        AND tm2.status = 'active'
    )
);

-- Create indexes for performance
CREATE INDEX idx_error_tracking_user_id ON public.error_tracking(user_id);
CREATE INDEX idx_error_tracking_created_at ON public.error_tracking(created_at DESC);
CREATE INDEX idx_error_tracking_severity ON public.error_tracking(severity);
CREATE INDEX idx_error_tracking_resolved ON public.error_tracking(resolved) WHERE resolved = false;
CREATE INDEX idx_error_tracking_type ON public.error_tracking(error_type);

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);

-- Helper function to log activity
CREATE OR REPLACE FUNCTION public.log_activity(
    _action TEXT,
    _entity_type TEXT DEFAULT NULL,
    _entity_id UUID DEFAULT NULL,
    _details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _id UUID;
BEGIN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), _action, _entity_type, _entity_id, _details)
    RETURNING id INTO _id;
    RETURN _id;
END;
$$;

-- Helper function to log errors
CREATE OR REPLACE FUNCTION public.log_error(
    _error_type TEXT,
    _message TEXT,
    _stack_trace TEXT DEFAULT NULL,
    _severity TEXT DEFAULT 'error',
    _page_url TEXT DEFAULT NULL,
    _metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _id UUID;
BEGIN
    INSERT INTO public.error_tracking (user_id, error_type, message, stack_trace, severity, page_url, metadata)
    VALUES (auth.uid(), _error_type, _message, _stack_trace, _severity, _page_url, _metadata)
    RETURNING id INTO _id;
    RETURN _id;
END;
$$;
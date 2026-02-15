import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  preferred_language: string;
  avatar_url: string | null;
}

interface TeamMembership {
  id: string;
  team_id: string;
  role: 'captain' | 'vice_captain' | 'member';
  status: 'active' | 'inactive';
  teams: {
    id: string;
    name: string;
    full_score_value: number;
  };
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  teamMemberships: TeamMembership[];
  loading: boolean;
  isCaptain: boolean;
  isAdmin: boolean;
  signIn: (phone: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (phone: string, password: string, name: string) => Promise<{ error: Error | null; groupsJoined?: number }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// Convert phone number to fake email for Supabase Auth
const phoneToEmail = (phone: string) => `${phone}@demo.kaamkibaat.app`;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teamMemberships, setTeamMemberships] = useState<TeamMembership[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Track individual loading states
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [membershipsLoaded, setMembershipsLoaded] = useState(false);
  const [adminLoaded, setAdminLoaded] = useState(false);
  
  // Loading is true until auth is checked AND all user data is fetched (if user exists)
  const loading = authLoading || (user !== null && (!profileLoaded || !membershipsLoaded || !adminLoaded));

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (data) {
        setProfile(data as Profile);
      }
    } finally {
      setProfileLoaded(true);
    }
  };

  const fetchTeamMemberships = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('team_memberships')
        .select(`
          id,
          team_id,
          role,
          status,
          teams (
            id,
            name,
            full_score_value
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active');
      
      if (data) {
        setTeamMemberships(data as unknown as TeamMembership[]);
      }
    } finally {
      setMembershipsLoaded(true);
    }
  };

  const fetchAdminStatus = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      setIsAdmin(!!data);
    } finally {
      setAdminLoaded(true);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
      await fetchTeamMemberships(user.id);
      await fetchAdminStatus(user.id);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Reset loaded states for new user
          setProfileLoaded(false);
          setMembershipsLoaded(false);
          setAdminLoaded(false);
          
          setTimeout(() => {
            fetchProfile(session.user.id);
            fetchTeamMemberships(session.user.id);
            fetchAdminStatus(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setTeamMemberships([]);
          setIsAdmin(false);
          // No user, so mark all as loaded
          setProfileLoaded(true);
          setMembershipsLoaded(true);
          setAdminLoaded(true);
        }
        
        setAuthLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchTeamMemberships(session.user.id);
        fetchAdminStatus(session.user.id);
      } else {
        // No user, mark all as loaded
        setProfileLoaded(true);
        setMembershipsLoaded(true);
        setAdminLoaded(true);
      }
      
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (phone: string, password: string) => {
    const email = phoneToEmail(phone);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signUp = async (phone: string, password: string, name: string) => {
    const email = phoneToEmail(phone);
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: data.user.id,
          name,
          phone,
          preferred_language: 'hi'
        });

      if (profileError) {
        return { error: new Error(profileError.message) };
      }

      // Add default worker role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: data.user.id,
          role: 'worker'
        });

      if (roleError) {
        console.error('Error adding role:', roleError);
      }

      // Check for pending invitations for this phone number and auto-join groups
      const { data: pendingInvites } = await supabase
        .from('pending_invitations')
        .select('*')
        .eq('phone', phone);

      if (pendingInvites && pendingInvites.length > 0) {
        // Create team memberships for each pending invitation
        for (const invite of pendingInvites) {
          await supabase
            .from('team_memberships')
            .insert({
              team_id: invite.team_id,
              user_id: data.user.id,
              role: invite.role,
              status: 'active'
            });
        }

        // Delete processed invitations
        await supabase
          .from('pending_invitations')
          .delete()
          .eq('phone', phone);

        return { error: null, groupsJoined: pendingInvites.length };
      }
    }

    return { error: null, groupsJoined: 0 };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setTeamMemberships([]);
    setIsAdmin(false);
    setProfileLoaded(false);
    setMembershipsLoaded(false);
    setAdminLoaded(false);
  };

  const isCaptain = teamMemberships.some(m => m.role === 'captain');

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      teamMemberships,
      loading,
      isCaptain,
      isAdmin,
      signIn,
      signUp,
      signOut,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

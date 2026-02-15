import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import MobileLayout from '@/components/layout/MobileLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, ClipboardCheck, TrendingUp, Plus } from 'lucide-react';

interface CaptainStats {
  totalMembers: number;
  pendingApprovals: number;
  todayCompletions: number;
  weeklyAvgScore: number;
  pendingReviews: number;
}

export default function CaptainDashboard() {
  const { user, profile, teamMemberships, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<CaptainStats>({
    totalMembers: 0,
    pendingApprovals: 0,
    todayCompletions: 0,
    weeklyAvgScore: 0,
    pendingReviews: 0
  });
  const [loading, setLoading] = useState(true);

  const captainTeams = teamMemberships.filter(m => m.role === 'captain');
  const teamIds = captainTeams.map(t => t.team_id);

  useEffect(() => {
    if (user && teamIds.length > 0) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [user, teamMemberships]);

  const fetchStats = async () => {
    if (!user || teamIds.length === 0) return;
    
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
      // Total members across captain's teams
      const { count: membersCount } = await supabase
        .from('team_memberships')
        .select('*', { count: 'exact', head: true })
        .in('team_id', teamIds)
        .eq('status', 'active');

      // Pending task approvals
      const { count: pendingCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .in('team_id', teamIds)
        .eq('status', 'pending_approval');

      // Today's completions
      const { count: completionsCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .in('team_id', teamIds)
        .eq('status', 'completed')
        .eq('scheduled_date', today);

      // Weekly avg score
      const { data: scores } = await supabase
        .from('daily_scores')
        .select('final_score')
        .not('final_score', 'is', null)
        .gte('date', weekAgo);

      const avgScore = scores?.length 
        ? Math.round(scores.reduce((sum, s) => sum + (s.final_score || 0), 0) / scores.length)
        : 0;

      // Pending reviews (completed tasks not yet validated by captain)
      const { count: pendingReviewsCount } = await supabase
        .from('daily_scores')
        .select('*, task_assignments!inner(task_id, tasks!inner(team_id))', { count: 'exact', head: true })
        .is('validated_by_user_id', null)
        .not('auto_score', 'is', null);

      setStats({
        totalMembers: membersCount || 0,
        pendingApprovals: pendingCount || 0,
        todayCompletions: completionsCount || 0,
        weeklyAvgScore: avgScore,
        pendingReviews: pendingReviewsCount || 0
      });
    } catch (error) {
      console.error('Error fetching captain stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  if (captainTeams.length === 0) {
    return (
      <MobileLayout>
        <div className="p-4">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground mb-4">
                You're not a captain of any team yet.
              </p>
              <Button onClick={() => navigate('/team/create')}>
                Create a Team
              </Button>
            </CardContent>
          </Card>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="p-4 space-y-6">
        {/* Header */}
        <div>
          <p className="text-sm text-muted-foreground">Captain Dashboard</p>
          <h1 className="text-xl font-bold text-foreground">
            {profile?.name || 'Captain'}
          </h1>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalMembers}</p>
                  <p className="text-xs text-muted-foreground">Team Members</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={stats.pendingApprovals > 0 ? 'border-warning border-2' : ''}
            onClick={() => navigate('/tasks?filter=pending')}
          >
            <CardContent className="p-4 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <ClipboardCheck className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pendingApprovals}</p>
                  <p className="text-xs text-muted-foreground">Pending Approval</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.weeklyAvgScore}/10</p>
                  <p className="text-xs text-muted-foreground">Weekly Avg Score</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.todayCompletions}</p>
                  <p className="text-xs text-muted-foreground">Completed Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Reviews - Prominent Card */}
        {stats.pendingReviews > 0 && (
          <Card 
            className="border-2 border-primary bg-primary/5 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/review')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
                    <ClipboardCheck className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-lg font-bold">{stats.pendingReviews} submissions to review</p>
                    <p className="text-sm text-muted-foreground">Workers are waiting for feedback</p>
                  </div>
                </div>
                <Button size="sm">Review Now</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Button 
              className="h-14 flex-col gap-1"
              onClick={() => navigate('/tasks/create')}
            >
              <Plus className="h-5 w-5" />
              <span className="text-xs">Create Task</span>
            </Button>
            <Button 
              variant={stats.pendingReviews > 0 ? "default" : "outline"}
              className="h-14 flex-col gap-1 relative"
              onClick={() => navigate('/review')}
            >
              <ClipboardCheck className="h-5 w-5" />
              <span className="text-xs">Daily Review</span>
              {stats.pendingReviews > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                  {stats.pendingReviews}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Teams */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Your Teams</h2>
          <div className="space-y-2">
            {captainTeams.map((membership) => (
              <Card 
                key={membership.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/team/${membership.team_id}`)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{membership.teams.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ₹{membership.teams.full_score_value} per 10/10 day
                    </p>
                  </div>
                  <Button variant="ghost" size="sm">
                    Manage
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}

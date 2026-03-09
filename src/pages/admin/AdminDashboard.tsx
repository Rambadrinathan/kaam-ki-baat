import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { getTranslation } from '@/utils/i18n';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Users, Building2, UserCheck, FileText, TrendingUp, Calendar, Search, ArrowLeft, Download, ChevronRight, Image, LogOut } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { TeamMemberWithStats } from '@/types';

interface Submission {
  id: string;
  date: string;
  auto_score: number | null;
  final_score: number | null;
  summary_text: string | null;
  validated_by_user_id: string | null;
  worker_name: string;
  task_title: string;
  team_name: string | null;
  team_id: string | null;
  captain_name: string | null;
}

interface Team {
  id: string;
  name: string;
  captain_name: string | null;
  member_count: number;
  submission_count: number;
  avg_score: number;
}

interface WorkLog {
  id: string;
  image_url: string | null;
  note_text: string | null;
  timestamp: string;
  worker_name: string;
}

interface Stats {
  totalTeams: number;
  totalCaptains: number;
  totalWorkers: number;
  totalSubmissions: number;
  avgScore: number;
}

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export default function AdminDashboard() {
  const { isAdmin, loading: authLoading, signOut } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = getTranslation(language);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalTeams: 0,
    totalCaptains: 0,
    totalWorkers: 0,
    totalSubmissions: 0,
    avgScore: 0
  });
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);

  // Team drill-down state
  const [selectedTeamForDrilldown, setSelectedTeamForDrilldown] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberWithStats[]>([]);
  const [teamWorkLogs, setTeamWorkLogs] = useState<WorkLog[]>([]);
  const [teamSubmissions, setTeamSubmissions] = useState<Submission[]>([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchAllData();
    }
  }, [isAdmin]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchStats(), fetchTeams(), fetchSubmissions()]);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
    const [teamsResult, membershipsResult, scoresResult] = await Promise.all([
      supabase.from('teams').select('id', { count: 'exact', head: true }),
      supabase.from('team_memberships').select('id, role', { count: 'exact' }).eq('status', 'active'),
      supabase.from('daily_scores').select('final_score, auto_score')
    ]);

    const totalTeams = teamsResult.count || 0;
    const memberships = membershipsResult.data || [];
    const captains = memberships.filter(m => m.role === 'captain').length;
    const workers = memberships.filter(m => m.role === 'member').length;
    const scores = scoresResult.data || [];
    const totalSubmissions = scores.length;
    
    const validScores = scores
      .map(s => s.final_score ?? s.auto_score)
      .filter((s): s is number => s !== null);
    const avgScore = validScores.length > 0 
      ? validScores.reduce((a, b) => a + b, 0) / validScores.length 
      : 0;

    setStats({
      totalTeams,
      totalCaptains: captains,
      totalWorkers: workers,
      totalSubmissions,
      avgScore: Math.round(avgScore * 10) / 10
    });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchTeams = async () => {
    try {
    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name')
      .order('name');

    if (!teamsData) {
      setTeams([]);
      return;
    }

    const { data: memberships } = await supabase
      .from('team_memberships')
      .select('team_id, role, user_id')
      .eq('status', 'active');

    const captainUserIds = memberships
      ?.filter(m => m.role === 'captain')
      .map(m => m.user_id) || [];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, name')
      .in('user_id', captainUserIds);

    const { data: scores } = await supabase
      .from('daily_scores')
      .select('task_assignment_id, final_score, auto_score');

    const { data: assignments } = await supabase
      .from('task_assignments')
      .select('id, task_id');

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, team_id');

    const enrichedTeams: Team[] = teamsData.map(team => {
      const captainMembership = memberships?.find(m => m.team_id === team.id && m.role === 'captain');
      const captainProfile = profiles?.find(p => p.user_id === captainMembership?.user_id);
      const memberCount = memberships?.filter(m => m.team_id === team.id).length || 0;
      
      const teamTaskIds = tasks?.filter(t => t.team_id === team.id).map(t => t.id) || [];
      const teamAssignmentIds = assignments?.filter(a => teamTaskIds.includes(a.task_id)).map(a => a.id) || [];
      const teamScores = scores?.filter(s => teamAssignmentIds.includes(s.task_assignment_id)) || [];
      const submissionCount = teamScores.length;
      
      const validScores = teamScores
        .map(s => s.final_score ?? s.auto_score)
        .filter((s): s is number => s !== null);
      const avgScore = validScores.length > 0
        ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
        : 0;

      return {
        id: team.id,
        name: team.name,
        captain_name: captainProfile?.name || null,
        member_count: memberCount,
        submission_count: submissionCount,
        avg_score: avgScore
      };
    });

    setTeams(enrichedTeams);
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    }
  };

  const fetchSubmissions = async () => {
    try {
    const { data: scores } = await supabase
      .from('daily_scores')
      .select('id, date, auto_score, final_score, summary_text, validated_by_user_id, task_assignment_id')
      .order('date', { ascending: false })
      .limit(200);

    if (!scores || scores.length === 0) {
      setSubmissions([]);
      return;
    }

    const taskAssignmentIds = scores.map(s => s.task_assignment_id);
    const { data: assignments } = await supabase
      .from('task_assignments')
      .select('id, assigned_to_user_id, task_id')
      .in('id', taskAssignmentIds);

    const taskIds = assignments?.map(a => a.task_id) || [];
    const workerIds = assignments?.map(a => a.assigned_to_user_id) || [];

    const [tasksResult, workersResult] = await Promise.all([
      supabase.from('tasks').select('id, title, team_id').in('id', taskIds),
      supabase.from('profiles').select('user_id, name').in('user_id', workerIds)
    ]);

    const teamIds = tasksResult.data?.map(t => t.team_id).filter(Boolean) || [];
    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', teamIds as string[]);

    const { data: captainMemberships } = await supabase
      .from('team_memberships')
      .select('team_id, user_id')
      .eq('role', 'captain')
      .eq('status', 'active')
      .in('team_id', teamIds as string[]);

    const captainUserIds = captainMemberships?.map(m => m.user_id) || [];
    const { data: captainProfiles } = await supabase
      .from('profiles')
      .select('user_id, name')
      .in('user_id', captainUserIds);

    const enrichedSubmissions: Submission[] = scores.map(score => {
      const assignment = assignments?.find(a => a.id === score.task_assignment_id);
      const task = tasksResult.data?.find(t => t.id === assignment?.task_id);
      const worker = workersResult.data?.find(w => w.user_id === assignment?.assigned_to_user_id);
      const team = teamsData?.find(t => t.id === task?.team_id);
      const captainMembership = captainMemberships?.find(m => m.team_id === task?.team_id);
      const captain = captainProfiles?.find(p => p.user_id === captainMembership?.user_id);

      return {
        id: score.id,
        date: score.date,
        auto_score: score.auto_score,
        final_score: score.final_score,
        summary_text: score.summary_text,
        validated_by_user_id: score.validated_by_user_id,
        worker_name: worker?.name || 'Unknown',
        task_title: task?.title || 'Unknown Task',
        team_name: team?.name || null,
        team_id: task?.team_id || null,
        captain_name: captain?.name || null
      };
    });

    setSubmissions(enrichedSubmissions);
    } catch (err) {
      console.error('Failed to fetch submissions:', err);
    }
  };

  // Team drill-down
  const handleTeamClick = async (team: Team) => {
    setSelectedTeamForDrilldown(team);
    setDrilldownLoading(true);

    try {
      // Fetch team members
      const { data: memberships } = await supabase
        .from('team_memberships')
        .select('user_id, role')
        .eq('team_id', team.id)
        .eq('status', 'active');

      const memberUserIds = memberships?.map(m => m.user_id) || [];
      
      const { data: memberProfiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', memberUserIds);

      // Get submission counts per member
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('team_id', team.id);

      const taskIds = tasks?.map(t => t.id) || [];

      const { data: assignments } = await supabase
        .from('task_assignments')
        .select('id, assigned_to_user_id, task_id')
        .in('task_id', taskIds);

      const assignmentIds = assignments?.map(a => a.id) || [];

      const { data: scores } = await supabase
        .from('daily_scores')
        .select('task_assignment_id')
        .in('task_assignment_id', assignmentIds);

      const members: TeamMemberWithStats[] = (memberships || []).map(m => {
        const profile = memberProfiles?.find(p => p.user_id === m.user_id);
        const memberAssignments = assignments?.filter(a => a.assigned_to_user_id === m.user_id).map(a => a.id) || [];
        const submissionCount = scores?.filter(s => memberAssignments.includes(s.task_assignment_id)).length || 0;
        
        return {
          user_id: m.user_id,
          name: profile?.name || 'Unknown',
          role: m.role,
          submission_count: submissionCount
        };
      });

      setTeamMembers(members);

      // Fetch team submissions (filter from existing submissions)
      const teamSubs = submissions.filter(s => s.team_id === team.id);
      setTeamSubmissions(teamSubs);

      // Fetch recent work logs with photos for team
      const { data: workLogs } = await supabase
        .from('work_logs')
        .select('id, image_url, note_text, timestamp, created_by_user_id')
        .in('task_assignment_id', assignmentIds)
        .not('image_url', 'is', null)
        .order('timestamp', { ascending: false })
        .limit(10);

      const workLogUserIds = workLogs?.map(w => w.created_by_user_id).filter(Boolean) || [];
      const { data: workLogProfiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', workLogUserIds as string[]);

      const enrichedWorkLogs: WorkLog[] = (workLogs || []).map(log => ({
        id: log.id,
        image_url: log.image_url,
        note_text: log.note_text,
        timestamp: log.timestamp,
        worker_name: workLogProfiles?.find(p => p.user_id === log.created_by_user_id)?.name || 'Unknown'
      }));

      setTeamWorkLogs(enrichedWorkLogs);
    } catch (error) {
      console.error('Error fetching team details:', error);
    } finally {
      setDrilldownLoading(false);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Date', 'Worker', 'Task', 'Team', 'Captain', 'AI Score', 'Final Score', 'Status'];
    const rows = filteredSubmissions.map(s => [
      format(new Date(s.date), 'yyyy-MM-dd'),
      s.worker_name,
      s.task_title,
      s.team_name || '-',
      s.captain_name || '-',
      s.auto_score !== null ? s.auto_score : '-',
      s.final_score !== null ? s.final_score : '-',
      s.validated_by_user_id ? 'Verified' : 'Pending'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kaam-ki-baat-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  // Chart data preparation
  const getSubmissionTrendData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return format(date, 'yyyy-MM-dd');
    });

    return last7Days.map(date => {
      const count = submissions.filter(s => s.date === date).length;
      return {
        date: format(parseISO(date), 'dd MMM'),
        submissions: count
      };
    });
  };

  const getScoreDistributionData = () => {
    const distribution = { poor: 0, average: 0, good: 0, excellent: 0 };
    
    submissions.forEach(s => {
      const score = s.final_score ?? s.auto_score;
      if (score === null) return;
      if (score <= 3) distribution.poor++;
      else if (score <= 6) distribution.average++;
      else if (score <= 8) distribution.good++;
      else distribution.excellent++;
    });

    return [
      { name: 'Poor (0-3)', value: distribution.poor, fill: 'hsl(var(--destructive))' },
      { name: 'Average (4-6)', value: distribution.average, fill: 'hsl(var(--chart-3))' },
      { name: 'Good (7-8)', value: distribution.good, fill: 'hsl(var(--chart-2))' },
      { name: 'Excellent (9-10)', value: distribution.excellent, fill: 'hsl(var(--primary))' }
    ].filter(d => d.value > 0);
  };

  const getTeamPerformanceData = () => {
    return teams
      .filter(t => t.submission_count > 0)
      .map(t => ({
        name: t.name,
        avgScore: t.avg_score,
        submissions: t.submission_count
      }));
  };

  // Apply filters
  const filteredSubmissions = submissions.filter(s => {
    if (selectedTeam !== 'all' && s.team_id !== selectedTeam) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!s.worker_name.toLowerCase().includes(query) && 
          !s.task_title.toLowerCase().includes(query) &&
          !(s.team_name?.toLowerCase().includes(query)) &&
          !(s.captain_name?.toLowerCase().includes(query))) {
        return false;
      }
    }
    if (dateFrom && s.date < dateFrom) return false;
    if (dateTo && s.date > dateTo) return false;
    return true;
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const trendData = getSubmissionTrendData();
  const scoreDistribution = getScoreDistributionData();
  const teamPerformance = getTeamPerformanceData();

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t.masterAdmin}</h1>
              <p className="text-sm text-muted-foreground">{t.organizationOverview}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={exportToCSV} className="gap-2">
              <Download className="h-4 w-4" />
              {t.downloadReport}
            </Button>
            <Button 
              variant="outline" 
              onClick={async () => {
                await signOut();
                navigate('/auth');
              }}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              {t.signOut}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalTeams}</p>
                  <p className="text-xs text-muted-foreground">{t.team}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalCaptains}</p>
                  <p className="text-xs text-muted-foreground">{t.captain}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalWorkers}</p>
                  <p className="text-xs text-muted-foreground">{t.kaarigar}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalSubmissions}</p>
                  <p className="text-xs text-muted-foreground">{t.allSubmissions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.avgScore}/10</p>
                  <p className="text-xs text-muted-foreground">{t.avgScore}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid md:grid-cols-3 gap-4">
          {/* Submission Trends */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t.submissionTrends}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="submissions" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Score Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t.scoreDistribution}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                {scoreDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={scoreDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {scoreDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Legend fontSize={10} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    {t.noScoreData}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Team Performance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t.teamPerformance}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                {teamPerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teamPerformance} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" domain={[0, 10]} fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" fontSize={10} tickLine={false} axisLine={false} width={80} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Bar dataKey="avgScore" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    {t.noTeamData}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Teams Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t.teamOverview}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teams.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">{t.noTeamsFound}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.teamName}</TableHead>
                    <TableHead>{t.captain}</TableHead>
                    <TableHead className="text-center">{t.members}</TableHead>
                    <TableHead className="text-center">{t.allSubmissions}</TableHead>
                    <TableHead className="text-center">{t.avgScore}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map(team => (
                    <TableRow 
                      key={team.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleTeamClick(team)}
                    >
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell>{team.captain_name || '-'}</TableCell>
                      <TableCell className="text-center">{team.member_count}</TableCell>
                      <TableCell className="text-center">{team.submission_count}</TableCell>
                      <TableCell className="text-center">
                        {team.avg_score > 0 ? `${team.avg_score}/10` : '-'}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Submissions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t.allSubmissions}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allTeams}</SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-[140px]"
                  placeholder="From"
                />
                <span className="text-muted-foreground">{t.to}</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-[140px]"
                  placeholder="To"
                />
              </div>
            </div>

            {/* Results count */}
            <p className="text-sm text-muted-foreground">
              {t.showingSubmissions} {filteredSubmissions.length} {t.ofSubmissions} {submissions.length} {t.submissionsLabel}
            </p>

            {/* Table */}
            {filteredSubmissions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t.noSubmissions}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.date}</TableHead>
                      <TableHead>{t.kaarigar}</TableHead>
                      <TableHead>{t.task}</TableHead>
                      <TableHead>{t.team}</TableHead>
                      <TableHead>{t.captain}</TableHead>
                      <TableHead className="text-center">{t.aiScore}</TableHead>
                      <TableHead className="text-center">{t.finalScore}</TableHead>
                      <TableHead className="text-center">{t.status}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubmissions.map(submission => (
                      <TableRow key={submission.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(submission.date), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell className="font-medium">{submission.worker_name}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{submission.task_title}</TableCell>
                        <TableCell>{submission.team_name || '-'}</TableCell>
                        <TableCell>{submission.captain_name || '-'}</TableCell>
                        <TableCell className="text-center">
                          {submission.auto_score !== null ? `${submission.auto_score}/10` : '-'}
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          {submission.final_score !== null ? `${submission.final_score}/10` : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {submission.validated_by_user_id ? (
                            <Badge variant="default" className="bg-primary/10 text-primary hover:bg-primary/20">
                              {t.verified}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              {t.pending}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Team Drill-down Dialog */}
      <Dialog open={!!selectedTeamForDrilldown} onOpenChange={(open) => !open && setSelectedTeamForDrilldown(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedTeamForDrilldown?.name}
            </DialogTitle>
          </DialogHeader>

          {drilldownLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Team Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">{teamMembers.length}</p>
                    <p className="text-xs text-muted-foreground">{t.members}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">{selectedTeamForDrilldown?.submission_count || 0}</p>
                    <p className="text-xs text-muted-foreground">{t.allSubmissions}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">{selectedTeamForDrilldown?.avg_score || 0}/10</p>
                    <p className="text-xs text-muted-foreground">{t.avgScore}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Team Members */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t.teamMembers}
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.name}</TableHead>
                        <TableHead>{t.role}</TableHead>
                        <TableHead className="text-center">{t.allSubmissions}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers.map(member => (
                        <TableRow key={member.user_id}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>
                            <Badge variant={member.role === 'captain' ? 'default' : 'secondary'}>
                              {member.role === 'captain' ? t.captain : t.kaarigar}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{member.submission_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Recent Work Photos */}
              {teamWorkLogs.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    {t.recentWorkPhotos}
                  </h4>
                  <div className="grid grid-cols-5 gap-2">
                    {teamWorkLogs.map(log => (
                      <div key={log.id} className="relative group">
                        <img 
                          src={log.image_url!} 
                          alt="Work" 
                          className="w-full aspect-square object-cover rounded-lg border"
                        />
                        <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-end p-1">
                          <span className="text-[10px] text-background truncate">{log.worker_name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Team Submissions */}
              {teamSubmissions.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {t.recentSubmissions}
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.date}</TableHead>
                          <TableHead>{t.kaarigar}</TableHead>
                          <TableHead>{t.task}</TableHead>
                          <TableHead className="text-center">{t.score}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamSubmissions.slice(0, 5).map(sub => (
                          <TableRow key={sub.id}>
                            <TableCell>{format(new Date(sub.date), 'dd MMM')}</TableCell>
                            <TableCell>{sub.worker_name}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{sub.task_title}</TableCell>
                            <TableCell className="text-center font-bold">
                              {sub.final_score ?? sub.auto_score ?? '-'}/10
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

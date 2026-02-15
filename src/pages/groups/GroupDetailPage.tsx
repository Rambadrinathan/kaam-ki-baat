import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import MobileLayout from '@/components/layout/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Settings, 
  ArrowLeft, 
  Mic, 
  CheckCircle2, 
  Clock, 
  Circle,
  Star,
  UserPlus
} from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description_text: string | null;
  status: string;
  type: string;
  scheduled_date: string;
  estimated_slots: number;
  created_by_user_id: string | null;
  created_at: string;
  creator_name?: string;
  score?: number | null;
}

interface GroupDetails {
  id: string;
  name: string;
  description: string | null;
  full_score_value: number;
}

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user, teamMemberships } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (groupId && user) {
      fetchGroupData();
    }
  }, [groupId, user]);

  const fetchGroupData = async () => {
    if (!groupId) return;

    try {
      // Fetch group details
      const { data: groupData, error: groupError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);

      // Check if user is admin of this group
      const membership = teamMemberships?.find(m => m.team_id === groupId);
      setIsAdmin(membership?.role === 'captain' || membership?.role === 'vice_captain');

      // Fetch tasks for this group
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('team_id', groupId)
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // Fetch creator names and scores for tasks
      const tasksWithDetails = await Promise.all(
        (tasksData || []).map(async (task) => {
          let creator_name: string = t.unknown;
          let score = null;

          // Get creator name
          if (task.created_by_user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name')
              .eq('user_id', task.created_by_user_id)
              .single();
            if (profile) creator_name = profile.name;
          }

          // Get score if task is completed
          if (task.status === 'completed') {
            const { data: assignment } = await supabase
              .from('task_assignments')
              .select('id')
              .eq('task_id', task.id)
              .single();

            if (assignment) {
              const { data: dailyScore } = await supabase
                .from('daily_scores')
                .select('final_score, auto_score')
                .eq('task_assignment_id', assignment.id)
                .single();

              if (dailyScore) {
                score = dailyScore.final_score ?? dailyScore.auto_score;
              }
            }
          }

          return { ...task, creator_name, score };
        })
      );

      setTasks(tasksWithDetails);
    } catch (error) {
      console.error('Error fetching group data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-6 w-6 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-6 w-6 text-amber-500" />;
      default:
        return <Circle className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-700 text-base font-semibold px-3 py-1">{t.done}</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-base font-semibold px-3 py-1">{t.inProgress}</Badge>;
      case 'open':
        return <Badge variant="secondary" className="text-base font-semibold px-3 py-1">{t.open}</Badge>;
      default:
        return <Badge variant="outline" className="text-base font-semibold px-3 py-1">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  if (!group) {
    return (
      <MobileLayout>
        <div className="p-4 text-center">
          <p className="text-muted-foreground">{t.groupNotFound}</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            {t.backToGroups}
          </Button>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showNav={false}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b z-10">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="h-7 w-7" />
              </Button>
              <div>
                <h1 className="font-bold text-2xl">{group.name}</h1>
                {group.description && (
                  <p className="text-lg text-muted-foreground truncate max-w-[200px] font-medium">
                    {group.description}
                  </p>
                )}
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12"
                  onClick={() => navigate(`/groups/${groupId}/settings?addMember=true`)}
                >
                  <UserPlus className="h-7 w-7" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12"
                  onClick={() => navigate(`/groups/${groupId}/settings`)}
                >
                  <Settings className="h-7 w-7" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Tasks List */}
        <div className="flex-1 overflow-auto p-4 pb-24">
          {tasks.length > 0 ? (
            <div className="space-y-3">
              {tasks.map((task) => (
                <Card
                  key={task.id}
                  className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
                  onClick={() => navigate(`/groups/${groupId}/tasks/${task.id}`)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {getStatusIcon(task.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xl font-bold line-clamp-2">{task.title}</p>
                          {task.score !== null && (
                            <div className="flex items-center gap-1.5 text-amber-500 flex-shrink-0">
                              <Star className="h-7 w-7 fill-current" />
                              <span className="text-2xl font-bold">{task.score}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-lg text-muted-foreground font-medium">
                          <span>{task.creator_name}</span>
                          <span>•</span>
                          <span>{format(new Date(task.scheduled_date), 'MMM d')}</span>
                        </div>
                        <div className="mt-3">
                          {getStatusBadge(task.status)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="mt-8">
              <CardContent className="p-8 text-center">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Mic className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-xl font-bold mb-2">{t.noTasksYet}</h2>
                <p className="text-lg text-muted-foreground mb-6">
                  {t.createFirstTask}
                </p>
                <Button onClick={() => navigate(`/groups/${groupId}/create-task`)} className="h-12 text-base">
                  <Plus className="h-6 w-6 mr-2" />
                  {t.createTask}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Floating Action Button */}
        {tasks.length > 0 && (
          <div className="fixed bottom-20 right-4 z-20">
            <Button
              size="lg"
              className="h-16 w-16 rounded-full shadow-lg"
              onClick={() => navigate(`/groups/${groupId}/create-task`)}
            >
              <Plus className="h-8 w-8" />
            </Button>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}

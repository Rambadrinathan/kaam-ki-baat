import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import MobileLayout from '@/components/layout/MobileLayout';
import TaskCard from '@/components/task/TaskCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description_text: string | null;
  image_url: string | null;
  estimated_slots: number;
  scheduled_date: string;
  status: string;
  type: 'captain_assigned' | 'self_proposed';
  created_by_user_id: string | null;
  profiles?: { name: string } | null;
}

export default function TasksPage() {
  const { user, teamMemberships, isCaptain, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [completedAssignments, setCompletedAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('filter') || 'available');
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const teamIds = teamMemberships.map(m => m.team_id);

  // Fetch all data on initial load
  useEffect(() => {
    if (user && !initialLoadDone) {
      fetchAllTasks();
    } else if (!user) {
      setLoading(false);
    }
  }, [user, teamMemberships]);

  // Re-fetch when tab changes (after initial load)
  useEffect(() => {
    if (user && initialLoadDone) {
      fetchTasks();
    }
  }, [activeTab]);

  // Fetch both available and my tasks on initial load to determine which tab to show
  const fetchAllTasks = async () => {
    if (!user) return;
    
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      // Fetch available tasks
      let availableTasks: Task[] = [];
      if (teamIds.length > 0) {
        const { data } = await supabase
          .from('tasks')
          .select('*')
          .in('team_id', teamIds)
          .eq('status', 'open')
          .eq('scheduled_date', today)
          .order('created_at', { ascending: false });
        
        availableTasks = (data || []) as Task[];
      }

      // Fetch my assignments
      const { data: assignmentData } = await supabase
        .from('task_assignments')
        .select(`
          id,
          status,
          tasks (
            id,
            title,
            description_text,
            image_url,
            estimated_slots,
            scheduled_date,
            status,
            type
          )
        `)
        .eq('assigned_to_user_id', user.id)
        .in('status', ['accepted', 'in_progress', 'pending'])
        .order('created_at', { ascending: false });
      
      const validAssignments = (assignmentData || []).filter(a => a.tasks !== null);

      setTasks(availableTasks);
      setMyAssignments(validAssignments);

      // Auto-select "My Tasks" tab if user has tasks but no available ones
      if (validAssignments.length > 0 && availableTasks.length === 0 && activeTab === 'available') {
        setActiveTab('mine');
      }

      setInitialLoadDone(true);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    if (!user) return;
    
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      if (activeTab === 'available') {
        if (teamIds.length > 0) {
          const { data } = await supabase
            .from('tasks')
            .select('*')
            .in('team_id', teamIds)
            .eq('status', 'open')
            .eq('scheduled_date', today)
            .order('created_at', { ascending: false });
          
          setTasks((data || []) as Task[]);
        } else {
          setTasks([]);
        }
      } else if (activeTab === 'mine') {
        const { data } = await supabase
          .from('task_assignments')
          .select(`
            id,
            status,
            tasks (
              id,
              title,
              description_text,
              image_url,
              estimated_slots,
              scheduled_date,
              status,
              type
            )
          `)
          .eq('assigned_to_user_id', user.id)
          .in('status', ['accepted', 'in_progress', 'pending'])
          .order('created_at', { ascending: false });
        
        const validAssignments = (data || []).filter(a => a.tasks !== null);
        setMyAssignments(validAssignments);
      } else if (activeTab === 'completed') {
        const { data } = await supabase
          .from('task_assignments')
          .select(`
            id,
            status,
            completed_at,
            tasks (
              id,
              title,
              description_text,
              image_url,
              estimated_slots,
              scheduled_date,
              status,
              type
            ),
            daily_scores (
              auto_score,
              final_score
            )
          `)
          .eq('assigned_to_user_id', user.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false });
        
        const validAssignments = (data || []).filter(a => a.tasks !== null);
        setCompletedAssignments(validAssignments);
      } else if (activeTab === 'pending' && isCaptain) {
        const { data } = await supabase
          .from('tasks')
          .select('*')
          .in('team_id', teamIds)
          .eq('status', 'pending_approval')
          .order('created_at', { ascending: false });
        
        setTasks((data || []) as Task[]);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <MobileLayout title="Tasks">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Tasks">
      <div className="p-4 space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full ${isCaptain ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <TabsTrigger value="available">Available</TabsTrigger>
            <TabsTrigger value="mine">Active</TabsTrigger>
            <TabsTrigger value="completed">Done</TabsTrigger>
            {isCaptain && <TabsTrigger value="pending">Pending</TabsTrigger>}
          </TabsList>

          <TabsContent value="available" className="space-y-3 mt-4">
            {tasks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No available tasks for today</p>
                <Button onClick={() => navigate('/tasks/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your Own Plan
                </Button>
              </div>
            ) : (
              tasks.map(task => (
                <TaskCard
                  key={task.id}
                  id={task.id}
                  title={task.title}
                  description={task.description_text || undefined}
                  imageUrl={task.image_url || undefined}
                  estimatedSlots={task.estimated_slots}
                  scheduledDate={task.scheduled_date}
                  status={task.status}
                  type={task.type}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="mine" className="space-y-3 mt-4">
            {myAssignments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No active tasks</p>
                <Button onClick={() => navigate('/tasks/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Start Your Day
                </Button>
              </div>
            ) : (
              myAssignments.map(assignment => {
                const task = assignment.tasks;
                if (!task) return null;
                return (
                  <TaskCard
                    key={assignment.id}
                    id={task.id}
                    title={task.title}
                    description={task.description_text || undefined}
                    imageUrl={task.image_url || undefined}
                    estimatedSlots={task.estimated_slots}
                    scheduledDate={task.scheduled_date}
                    status={assignment.status}
                    type={task.type}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                  />
                );
              })
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-3 mt-4">
            {completedAssignments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No completed tasks yet</p>
              </div>
            ) : (
              completedAssignments.map(assignment => {
                const task = assignment.tasks;
                if (!task) return null;
                const score = assignment.daily_scores?.[0]?.final_score || assignment.daily_scores?.[0]?.auto_score;
                return (
                  <div key={assignment.id} className="relative">
                    <TaskCard
                      id={task.id}
                      title={task.title}
                      description={task.description_text || undefined}
                      imageUrl={task.image_url || undefined}
                      estimatedSlots={task.estimated_slots}
                      scheduledDate={task.scheduled_date}
                      status="completed"
                      type={task.type}
                      onClick={() => navigate(`/tasks/${task.id}`)}
                    />
                    {score !== undefined && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-sm font-bold px-2 py-1 rounded-full">
                        {score}/10
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </TabsContent>

          {isCaptain && (
            <TabsContent value="pending" className="space-y-3 mt-4">
              {tasks.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No tasks pending approval</p>
                </div>
              ) : (
                tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    id={task.id}
                    title={task.title}
                    description={task.description_text || undefined}
                    imageUrl={task.image_url || undefined}
                    estimatedSlots={task.estimated_slots}
                    scheduledDate={task.scheduled_date}
                    status={task.status}
                    type={task.type}
                    assigneeName={task.profiles?.name}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                  />
                ))
              )}
            </TabsContent>
          )}
        </Tabs>

        {/* FAB for creating tasks */}
        <Button
          className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
          onClick={() => navigate(isCaptain ? '/tasks/create' : '/tasks/new')}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </MobileLayout>
  );
}

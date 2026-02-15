import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import MobileLayout from '@/components/layout/MobileLayout';
import PhotoUpload from '@/components/upload/PhotoUpload';
import VoiceRecorder from '@/components/voice/VoiceRecorder';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Clock, Calendar, CheckCircle, Pencil, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function TaskDetail() {
  const { taskId, groupId } = useParams();
  const { user, isCaptain } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [task, setTask] = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);

  // Progress update state
  const [updateImageUrl, setUpdateImageUrl] = useState('');
  const [updateVoiceUrl, setUpdateVoiceUrl] = useState('');
  const [updateNote, setUpdateNote] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
  const [submissionStage, setSubmissionStage] = useState<'idle' | 'uploading' | 'analyzing'>('idle');
  const [dailyScore, setDailyScore] = useState<any>(null);
  const [isCompletingTask, setIsCompletingTask] = useState(false);

  useEffect(() => {
    if (taskId) {
      fetchTask();
    }
  }, [taskId, user]);

  const fetchTask = async () => {
    if (!taskId || !user) return;
    
    setLoading(true);
    try {
      // Fetch task WITHOUT profile join (no FK exists)
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*, teams (name, full_score_value)')
        .eq('id', taskId)
        .maybeSingle();

      if (taskError) throw taskError;
      if (!taskData) {
        setTask(null);
        setLoading(false);
        return;
      }

      // Fetch creator profile separately if needed
      if (taskData.created_by_user_id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', taskData.created_by_user_id)
          .maybeSingle();
        
        (taskData as any).creator_name = profileData?.name;
      }

      setTask(taskData);

      // Fetch assignment
      const { data: assignmentData } = await supabase
        .from('task_assignments')
        .select('*')
        .eq('task_id', taskId)
        .eq('assigned_to_user_id', user.id)
        .maybeSingle();

      setAssignment(assignmentData);

      // Fetch work logs
      if (assignmentData) {
        const { data: logs } = await supabase
          .from('work_logs')
          .select('*')
          .eq('task_assignment_id', assignmentData.id)
          .order('timestamp', { ascending: false });

        setWorkLogs(logs || []);
        
        // Fetch score if task is completed
        if (assignmentData.status === 'completed') {
          const { data: scoreData } = await supabase
            .from('daily_scores')
            .select('*')
            .eq('task_assignment_id', assignmentData.id)
            .maybeSingle();
          
          setDailyScore(scoreData);
        }
      }
    } catch (error) {
      console.error('Error fetching task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskId) return;
    
    try {
      // Delete assignments first (FK constraint)
      await supabase
        .from('task_assignments')
        .delete()
        .eq('task_id', taskId);
      
      // Then delete task
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: t.taskDeleted,
        description: t.planRemoved
      });

      navigate('/tasks');
    } catch (error: any) {
      toast({
        title: t.error,
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleAcceptTask = async () => {
    if (!user || !taskId) return;
    
    setIsAccepting(true);
    try {
      // Create assignment
      const { error: assignmentError } = await supabase
        .from('task_assignments')
        .insert({
          task_id: taskId,
          assigned_to_user_id: user.id,
          status: 'accepted',
          accepted_at: new Date().toISOString()
        });

      if (assignmentError) throw assignmentError;

      // Update task status to in_progress immediately
      await supabase
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', taskId);

      toast({
        title: t.taskAccepted,
        description: t.goodLuckToday
      });

      fetchTask();
    } catch (error: any) {
      toast({
        title: t.error,
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsAccepting(false);
    }
  };


  const handleVoiceRecording = async (audioBlob: Blob, transcription: string) => {
    setIsTranscribing(true);
    
    // Upload the audio file to storage
    try {
      const fileName = `voice_${Date.now()}_${user?.id}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('work-uploads')
        .upload(fileName, audioBlob, { contentType: 'audio/webm' });
      
      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage
          .from('work-uploads')
          .getPublicUrl(uploadData.path);
        setUpdateVoiceUrl(urlData.publicUrl);
      }
    } catch (error) {
      console.error('Error uploading voice:', error);
    }
    
    // Also set transcription if available
    if (transcription) {
      setUpdateNote(prev => prev ? `${prev}\n${transcription}` : transcription);
    }
    setIsTranscribing(false);
  };

  const handleSubmitUpdate = async () => {
    // Allow ANY single input: photo OR voice OR text
    const hasContent = updateImageUrl || updateVoiceUrl || updateNote.trim();
    if (!assignment || !hasContent) {
      toast({
        title: t.addYourProgress,
        description: t.pleaseAddPhotoVoiceNote,
        variant: 'destructive'
      });
      return;
    }

    setIsSubmittingUpdate(true);
    setSubmissionStage('uploading');
    
    try {
      const { error } = await supabase
        .from('work_logs')
        .insert({
          task_assignment_id: assignment.id,
          image_url: updateImageUrl || null,
          voice_note_url: updateVoiceUrl || null,
          note_text: updateNote || null,
          created_by_user_id: user?.id
        });

      if (error) throw error;

      // Update assignment status
      await supabase
        .from('task_assignments')
        .update({ status: 'in_progress' })
        .eq('id', assignment.id);

      toast({
        title: `✅ ${t.updateSubmitted}`,
        description: t.progressSaved
      });

      setUpdateImageUrl('');
      setUpdateVoiceUrl('');
      setUpdateNote('');
      setSubmissionStage('idle');
      fetchTask();
    } catch (error: any) {
      toast({
        title: t.error,
        description: error.message,
        variant: 'destructive'
      });
      setSubmissionStage('idle');
    } finally {
      setIsSubmittingUpdate(false);
    }
  };

  const handleCompleteAndSubmit = async () => {
    if (!assignment) return;

    // Check if there's any content to submit
    const hasContent = updateImageUrl || updateVoiceUrl || updateNote.trim();
    
    setIsCompletingTask(true);
    setSubmissionStage('uploading');
    
    try {
      // Step 1: Save final work log if there's content
      if (hasContent) {
        const { error: logError } = await supabase
          .from('work_logs')
          .insert({
            task_assignment_id: assignment.id,
            image_url: updateImageUrl || null,
            voice_note_url: updateVoiceUrl || null,
            note_text: updateNote || null,
            created_by_user_id: user?.id
          });

        if (logError) throw logError;
      }

      // Step 2: Mark task as completed
      setSubmissionStage('analyzing');
      
      await supabase
        .from('task_assignments')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', assignment.id);

      await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', taskId);

      // Step 3: Trigger AI scoring
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({ taskAssignmentId: assignment.id })
      });

      if (response.ok) {
        toast({
          title: `✅ ${t.taskCompleted}`,
          description: t.scoreIsReady
        });
        // Clear inputs and refresh
        setUpdateImageUrl('');
        setUpdateVoiceUrl('');
        setUpdateNote('');
        fetchTask();
      } else {
        throw new Error('Failed to generate score');
      }
    } catch (error: any) {
      toast({
        title: t.error,
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsCompletingTask(false);
      setSubmissionStage('idle');
    }
  };

  if (loading) {
    return (
      <MobileLayout showNav={false}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  if (!task) {
    return (
      <MobileLayout showNav={false}>
        <div className="p-4 text-center">
          <p className="text-muted-foreground">{t.taskNotFound}</p>
        </div>
      </MobileLayout>
    );
  }

  const formattedDate = new Date(task.scheduled_date).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });

  const canAccept = task.status === 'open' && !assignment;
  const isAssigned = assignment && ['accepted', 'in_progress'].includes(assignment.status);
  const isCompleted = assignment?.status === 'completed';
  const canEditDelete = task.type === 'self_proposed' && 
                        task.created_by_user_id === user?.id && 
                        task.status !== 'completed';

  return (
    <MobileLayout showNav={false}>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold flex-1 line-clamp-1">{task.title}</h1>
          
          {/* Edit/Delete for self-proposed tasks */}
          {canEditDelete && (
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate(`/tasks/edit/${taskId}`, { state: { task } })}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t.deleteThisPlan}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t.permanentlyRemoveTask}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteTask}>{t.delete}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        {/* Task Image */}
        {task.image_url && (
          <div className="rounded-lg overflow-hidden">
            <img 
              src={task.image_url} 
              alt={task.title}
              className="w-full h-48 object-cover"
            />
          </div>
        )}

        {/* Task Info */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              {task.teams?.name && (
                <Badge variant="outline">{task.teams.name}</Badge>
              )}
              {task.type === 'self_proposed' && task.created_by_user_id === user?.id ? (
                <Badge variant="secondary">{t.yourPlanBadge}</Badge>
              ) : task.type === 'self_proposed' ? (
                <Badge variant="secondary">{t.selfProposedBadge}</Badge>
              ) : null}
            </div>
            
            <p className="text-foreground">{task.description_text}</p>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formattedDate}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {task.estimated_slots * 2}{t.hoursEstimated}
              </span>
            </div>

            {task.creator_name && task.created_by_user_id !== user?.id && (
              <p className="text-sm text-muted-foreground">
                {t.createdBy}: {task.creator_name}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        {canAccept && (
          <Button 
            className="w-full h-12" 
            onClick={handleAcceptTask}
            disabled={isAccepting}
          >
            {isAccepting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t.acceptTask}
          </Button>
        )}


        {/* Progress Update Section - Always visible when assigned */}
        {isAssigned && (
          <>
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  📸 {t.logYourProgress}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <PhotoUpload 
                  onUploadComplete={setUpdateImageUrl} 
                  existingUrl={updateImageUrl}
                />
                
                <VoiceRecorder 
                  onRecordingComplete={handleVoiceRecording}
                  isTranscribing={isTranscribing}
                />
                
                <Textarea
                  placeholder={t.addNoteAboutProgress}
                  value={updateNote}
                  onChange={(e) => setUpdateNote(e.target.value)}
                  rows={2}
                />
                
                {/* Two buttons: interim update OR complete & submit */}
                <div className="space-y-3">
                  <Button 
                    variant="outline"
                    className="w-full h-12"
                    onClick={handleSubmitUpdate}
                    disabled={isSubmittingUpdate || isCompletingTask || (!updateImageUrl && !updateVoiceUrl && !updateNote.trim())}
                  >
                    {isSubmittingUpdate ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t.savingUpdate}
                      </>
                    ) : t.saveProgressContinue}
                  </Button>
                  
                  <Button 
                    className="w-full h-14 bg-primary hover:bg-primary/90 text-lg font-semibold"
                    onClick={handleCompleteAndSubmit}
                    disabled={isCompletingTask || isSubmittingUpdate}
                  >
                    {isCompletingTask ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {submissionStage === 'uploading' ? t.savingWork : t.aiAnalyzing}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-5 w-5" />
                        {t.completeAndGetScore}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Work Log Timeline */}
            {workLogs.length > 0 && (
              <>
                <h3 className="font-medium text-sm text-muted-foreground">{t.previousUpdates}</h3>
                <div className="space-y-3">
                  {workLogs.map(log => (
                    <Card key={log.id}>
                      <CardContent className="p-3">
                        {log.image_url && (
                          <img 
                            src={log.image_url}
                            alt="Work update"
                            className="w-full h-32 object-cover rounded mb-2"
                          />
                        )}
                        {log.note_text && (
                          <p className="text-sm">{log.note_text}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(log.timestamp).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Score Display for Completed Tasks */}
        {isCompleted && dailyScore && (
          <Card className="border-primary bg-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                🏆 {t.yourScore}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center">
                <span className="text-5xl font-bold text-primary">
                  {dailyScore.auto_score || dailyScore.final_score || '—'}
                </span>
                <span className="text-2xl text-muted-foreground">/10</span>
              </div>
              {dailyScore.summary_text && (
                <p className="text-sm text-muted-foreground text-center">
                  {dailyScore.summary_text}
                </p>
              )}
              {dailyScore.ai_analysis && (
                <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                  {dailyScore.ai_analysis}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {isCompleted && !dailyScore && (
          <Card className="border-muted">
            <CardContent className="p-4 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">
                {t.aiAnalyzingWork}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
}

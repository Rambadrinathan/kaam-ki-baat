import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import MobileLayout from '@/components/layout/MobileLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Check, Minus, Plus, Image, Mic, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface WorkLogWithDetails {
  id: string;
  image_url: string;
  note_text: string | null;
  voice_note_url: string | null;
  timestamp: string;
}

interface DailyScoreWithDetails {
  id: string;
  date: string;
  auto_score: number | null;
  final_score: number | null;
  summary_text: string | null;
  ai_analysis: string | null;
  task_assignment_id: string;
  task_assignments: {
    id: string;
    assigned_to_user_id: string;
    tasks: {
      id: string;
      title: string;
      team_id: string;
      teams: {
        full_score_value: number;
      };
    };
    profiles: {
      name: string;
    };
  };
}

interface ReviewItem {
  score: DailyScoreWithDetails;
  workLogs: WorkLogWithDetails[];
  adjustment: number;
}

export default function DailyReview() {
  const { user, teamMemberships } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const captainTeams = teamMemberships.filter(m => m.role === 'captain');
  const teamIds = captainTeams.map(t => t.team_id);

  useEffect(() => {
    if (teamIds.length > 0) {
      fetchPendingReviews();
    } else {
      setLoading(false);
    }
  }, [teamMemberships]);

  const fetchPendingReviews = async () => {
    const today = new Date().toISOString().split('T')[0];

    try {
      // Get daily scores that need review (have auto_score but no final_score)
      const { data: scores, error } = await supabase
        .from('daily_scores')
        .select(`
          id,
          date,
          auto_score,
          final_score,
          summary_text,
          ai_analysis,
          task_assignment_id,
          task_assignments!inner(
            id,
            assigned_to_user_id,
            tasks!inner(
              id,
              title,
              team_id,
              teams(full_score_value)
            )
          )
        `)
        .is('final_score', null)
        .not('auto_score', 'is', null)
        .eq('date', today);

      if (error) throw error;

      // Filter to only captain's teams
      const filteredScores = (scores || []).filter((s: any) => 
        teamIds.includes(s.task_assignments.tasks.team_id)
      ) as unknown as DailyScoreWithDetails[];

      // Fetch profiles for each score
      const scoresWithProfiles = await Promise.all(
        filteredScores.map(async (score) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('user_id', score.task_assignments.assigned_to_user_id)
            .single();

          return {
            ...score,
            task_assignments: {
              ...score.task_assignments,
              profiles: profile || { name: 'Unknown' }
            }
          };
        })
      );

      // Fetch work logs for each score
      const itemsWithLogs = await Promise.all(
        scoresWithProfiles.map(async (score) => {
          const { data: logs } = await supabase
            .from('work_logs')
            .select('id, image_url, note_text, voice_note_url, timestamp')
            .eq('task_assignment_id', score.task_assignment_id)
            .order('timestamp', { ascending: true });

          return {
            score,
            workLogs: (logs || []) as WorkLogWithDetails[],
            adjustment: 0
          };
        })
      );

      setReviewItems(itemsWithLogs);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const adjustScore = (scoreId: string, delta: number) => {
    setReviewItems(items =>
      items.map(item => {
        if (item.score.id === scoreId) {
          const newAdjustment = Math.max(-2, Math.min(2, item.adjustment + delta));
          return { ...item, adjustment: newAdjustment };
        }
        return item;
      })
    );
  };

  const confirmScore = async (item: ReviewItem) => {
    setSubmitting(item.score.id);
    const finalScore = Math.max(0, Math.min(10, (item.score.auto_score || 0) + item.adjustment));
    const fullScoreValue = item.score.task_assignments.tasks.teams?.full_score_value || 500;
    const earnings = Math.round((finalScore / 10) * fullScoreValue);

    try {
      // Update daily score with final score
      const { error: scoreError } = await supabase
        .from('daily_scores')
        .update({
          final_score: finalScore,
          validated_by_user_id: user?.id,
          validation_timestamp: new Date().toISOString()
        })
        .eq('id', item.score.id);

      if (scoreError) throw scoreError;

      // Create earnings record
      const { error: earningsError } = await supabase
        .from('earnings')
        .insert({
          user_id: item.score.task_assignments.assigned_to_user_id,
          team_id: item.score.task_assignments.tasks.team_id,
          daily_score_id: item.score.id,
          date: item.score.date,
          score: finalScore,
          amount: earnings,
          status: 'calculated'
        });

      if (earningsError) throw earningsError;

      toast({
        title: t.scoreConfirmed,
        description: `${t.score}: ${finalScore}/10 • ₹${earnings}`
      });

      // Remove from list
      setReviewItems(items => items.filter(i => i.score.id !== item.score.id));
    } catch (error) {
      console.error('Error confirming score:', error);
      toast({
        title: t.error,
        description: t.failedToConfirmScore,
        variant: 'destructive'
      });
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{t.dailyReview}</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), 'EEEE, MMM d')}
            </p>
          </div>
        </div>

        {reviewItems.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Check className="h-12 w-12 text-primary mx-auto mb-4" />
              <p className="font-medium">{t.allCaughtUp}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t.noPendingReviewsToday}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {reviewItems.map((item) => {
              const finalScore = Math.max(0, Math.min(10, (item.score.auto_score || 0) + item.adjustment));
              const fullScoreValue = item.score.task_assignments.tasks.teams?.full_score_value || 500;
              const earnings = Math.round((finalScore / 10) * fullScoreValue);

              return (
                <Card key={item.score.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                      <CardTitle className="text-base">
                          {item.score.task_assignments.profiles?.name || t.worker}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {item.score.task_assignments.tasks.title}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">{finalScore}/10</p>
                        <p className="text-sm text-muted-foreground">₹{earnings}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* AI Analysis */}
                    {item.score.summary_text && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">{t.aiSummaryLabel}</p>
                        <p className="text-sm">{item.score.summary_text}</p>
                      </div>
                    )}

                    {/* Work Logs */}
                    {item.workLogs.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {item.workLogs.length} {t.updatesToday}
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {item.workLogs.map((log) => (
                            <div 
                              key={log.id} 
                              className="flex-shrink-0 w-20 space-y-1"
                            >
                              <div className="relative">
                                <img 
                                  src={log.image_url} 
                                  alt={t.workLogAlt}
                                  className="w-20 h-20 object-cover rounded-lg"
                                />
                                <div className="absolute bottom-1 left-1 flex gap-1">
                                  {log.note_text && (
                                    <div className="h-5 w-5 rounded-full bg-background/80 flex items-center justify-center">
                                      <Image className="h-3 w-3" />
                                    </div>
                                  )}
                                  {log.voice_note_url && (
                                    <div className="h-5 w-5 rounded-full bg-background/80 flex items-center justify-center">
                                      <Mic className="h-3 w-3" />
                                    </div>
                                  )}
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(log.timestamp), 'HH:mm')}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Score Adjustment */}
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{t.adjustScore}</p>
                        <p className="text-xs text-muted-foreground">
                          AI: {item.score.auto_score}/10
                          {item.adjustment !== 0 && (
                            <span className={item.adjustment > 0 ? 'text-primary' : 'text-destructive'}>
                              {' '}({item.adjustment > 0 ? '+' : ''}{item.adjustment})
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => adjustScore(item.score.id, -1)}
                          disabled={item.adjustment <= -2}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-bold text-lg">
                          {finalScore}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => adjustScore(item.score.id, 1)}
                          disabled={item.adjustment >= 2}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <Button 
                      className="w-full h-12"
                      onClick={() => confirmScore(item)}
                      disabled={submitting === item.score.id}
                    >
                      {submitting === item.score.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t.confirming}
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          {t.confirmScore}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}

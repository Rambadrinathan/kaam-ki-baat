import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import MobileLayout from '@/components/layout/MobileLayout';
import PhotoUpload from '@/components/upload/PhotoUpload';
import VoiceRecorder from '@/components/voice/VoiceRecorder';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function CreateSelfPlan() {
  const { user, teamMemberships } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  // Get transcription from navigation state (from voice-first home screen)
  const initialTranscription = (location.state as { transcription?: string })?.transcription || '';
  
  const [imageUrl, setImageUrl] = useState('');
  const [voiceNoteUrl, setVoiceNoteUrl] = useState('');
  const [description, setDescription] = useState(initialTranscription);
  const [estimatedSlots, setEstimatedSlots] = useState('2');
  const [selectedTeamId, setSelectedTeamId] = useState(teamMemberships[0]?.team_id || '');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update description if we get transcription from home screen
  useEffect(() => {
    if (initialTranscription) {
      setDescription(initialTranscription);
    }
  }, [initialTranscription]);

  const handleVoiceRecording = async (audioBlob: Blob, transcription: string) => {
    setIsTranscribing(true);
    
    try {
      // Upload audio blob
      if (user) {
        const fileName = `${user.id}/voice-${Date.now()}.webm`;
        const { error: uploadError, data } = await supabase.storage
          .from('work-uploads')
          .upload(fileName, audioBlob);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('work-uploads')
            .getPublicUrl(fileName);
          setVoiceNoteUrl(publicUrl);
        }
      }
      
      // Set transcription
      if (transcription) {
        setDescription(prev => prev ? `${prev}\n${transcription}` : transcription);
      }
    } catch (error) {
      console.error('Error handling voice recording:', error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !selectedTeamId || !description.trim()) {
      toast({
        title: t.missingInfo,
        description: t.describePlanAndSelectTeam,
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      // Create task - immediately active
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          team_id: selectedTeamId,
          created_by_user_id: user.id,
          type: 'self_proposed',
          title: description.substring(0, 50) + (description.length > 50 ? '...' : ''),
          description_text: description,
          image_url: imageUrl || null,
          voice_note_url: voiceNoteUrl || null,
          estimated_slots: parseInt(estimatedSlots),
          scheduled_date: today,
          status: 'in_progress'
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Create assignment - immediately active
      const { error: assignmentError } = await supabase
        .from('task_assignments')
        .insert({
          task_id: task.id,
          assigned_to_user_id: user.id,
          status: 'in_progress',
          accepted_at: new Date().toISOString()
        });

      if (assignmentError) throw assignmentError;

      toast({
        title: t.planIsActive,
        description: t.startWorkingLogProgress
      });

      navigate('/');
    } catch (error: any) {
      console.error('Error creating plan:', error);
      toast({
        title: t.error,
        description: error.message || t.failedToCreatePlan,
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MobileLayout showNav={false}>
      <div className="p-4 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">{t.todaysPlan}</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.whatsYourPlanToday}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Photo */}
            <div className="space-y-2">
              <Label>{t.photoOptional}</Label>
              <PhotoUpload onUploadComplete={setImageUrl} />
            </div>

            {/* Voice Recording */}
            <div className="space-y-2">
              <Label>{t.describeYourPlan}</Label>
              <VoiceRecorder 
                onRecordingComplete={handleVoiceRecording}
                isTranscribing={isTranscribing}
              />
            </div>

            {/* Text Description */}
            <div className="space-y-2">
              <Label htmlFor="description">{t.orTypeItOut}</Label>
              <Textarea
                id="description"
                placeholder={t.describePlanPlaceholder}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            {/* Estimated Time */}
            <div className="space-y-3">
              <Label>{t.howLongWillItTake}</Label>
              <RadioGroup 
                value={estimatedSlots} 
                onValueChange={setEstimatedSlots}
                className="grid grid-cols-4 gap-2"
              >
                {[1, 2, 3, 4].map(slot => (
                  <div key={slot}>
                    <RadioGroupItem
                      value={String(slot)}
                      id={`slot-${slot}`}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={`slot-${slot}`}
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <span className="text-lg font-bold">{slot}</span>
                      <span className="text-xs text-muted-foreground">
                        {slot * 2}h
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Team Selection */}
            {teamMemberships.length > 1 && (
              <div className="space-y-3">
                <Label>{t.selectTeam}</Label>
                <RadioGroup 
                  value={selectedTeamId} 
                  onValueChange={setSelectedTeamId}
                >
                  {teamMemberships.map(membership => (
                    <div key={membership.id} className="flex items-center space-x-2">
                      <RadioGroupItem 
                        value={membership.team_id} 
                        id={membership.team_id}
                      />
                      <Label htmlFor={membership.team_id}>
                        {membership.teams.name}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            <Button 
              className="w-full h-12" 
              onClick={handleSubmit}
              disabled={isSubmitting || !description.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.submitting}
                </>
              ) : (
                t.submitPlan
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}

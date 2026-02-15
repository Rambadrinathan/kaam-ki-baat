import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mic, Square, Loader2, Search, Check, RotateCcw, X } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/hooks/useAuth';
import { languageNames, Language } from '@/utils/i18n';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type FlowState = 'initial' | 'recording' | 'processing' | 'parsing' | 'review' | 'submitting' | 'submitted';

interface ParsedPlan {
  title: string;
  estimatedSlots: number;
  subtasks: string[];
  confidence: number;
}

export default function VoicePrompt() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const { user, teamMemberships } = useAuth();
  const { toast } = useToast();
  
  const [flowState, setFlowState] = useState<FlowState>('initial');
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcription, setTranscription] = useState('');
  const [parsedPlan, setParsedPlan] = useState<ParsedPlan | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        await processRecording(blob);
      };

      mediaRecorderRef.current.start();
      setFlowState('recording');
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: 'Microphone Error',
        description: 'Could not access microphone. Please check permissions.',
        variant: 'destructive'
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && flowState === 'recording') {
      mediaRecorderRef.current.stop();
      setFlowState('processing');

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const processRecording = async (audioBlob: Blob) => {
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      const base64Audio = (reader.result as string).split(',')[1];

      try {
        // Step 1: Transcribe
        const transcribeResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ audio: base64Audio, language }),
          }
        );

        const transcribeData = await transcribeResponse.json();

        if (transcribeData.text) {
          setTranscription(transcribeData.text);
          setFlowState('parsing');
          
          // Step 2: Parse the plan with AI
          try {
            const parseResponse = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-plan`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                },
                body: JSON.stringify({ transcription: transcribeData.text, language }),
              }
            );

            const parseData = await parseResponse.json();
            
            if (parseData.title) {
              setParsedPlan(parseData);
            } else {
              // Use fallback if parsing failed
              setParsedPlan({
                title: transcribeData.text.substring(0, 50),
                estimatedSlots: 2,
                subtasks: [],
                confidence: 0.5
              });
            }
          } catch (parseError) {
            console.error('Error parsing plan:', parseError);
            setParsedPlan({
              title: transcribeData.text.substring(0, 50),
              estimatedSlots: 2,
              subtasks: [],
              confidence: 0.5
            });
          }
          
          setFlowState('review');
        } else {
          toast({
            title: 'Transcription Error',
            description: 'Could not understand the audio. Please try again.',
            variant: 'destructive'
          });
          setFlowState('initial');
        }
      } catch (error) {
        console.error('Error transcribing:', error);
        toast({
          title: 'Error',
          description: 'Something went wrong. Please try again.',
          variant: 'destructive'
        });
        setFlowState('initial');
      }
    };
  };

  const handleSubmitPlan = async () => {
    if (!user || !transcription.trim()) return;

    setFlowState('submitting');
    const today = new Date().toISOString().split('T')[0];
    
    // Auto-select team: use first team if available, otherwise null (team is optional)
    const selectedTeamId = teamMemberships[0]?.team_id || null;
    
    // Use parsed plan data or defaults
    const title = parsedPlan?.title || transcription.substring(0, 50);
    const estimatedSlots = parsedPlan?.estimatedSlots || 2;

    try {
      // Create task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          team_id: selectedTeamId,
          created_by_user_id: user.id,
          type: 'self_proposed',
          title: title + (title.length >= 50 ? '...' : ''),
          description_text: transcription,
          estimated_slots: estimatedSlots,
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

      setFlowState('submitted');
      toast({
        title: t.planSubmitted,
        description: t.planActive
      });
    } catch (error: any) {
      console.error('Error creating plan:', error);
      toast({
        title: t.errorSubmitting,
        description: error.message || 'Please try again',
        variant: 'destructive'
      });
      setFlowState('review');
    }
  };

  const handleRecordAgain = () => {
    setTranscription('');
    setParsedPlan(null);
    setFlowState('initial');
    setIsEditing(false);
  };

  const handleSubmitAnother = () => {
    setTranscription('');
    setParsedPlan(null);
    setFlowState('initial');
    setIsEditing(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSlotLabel = (slots: number) => {
    const hours = slots * 2;
    if (language === 'hi') return `~${hours} घंटे`;
    if (language === 'bn') return `~${hours} ঘন্টা`;
    return `~${hours} hours`;
  };

  const languages: Language[] = ['bn', 'hi', 'en'];

  // Render based on flow state
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 space-y-8">
      {/* Language Toggle - always visible except when submitting */}
      {flowState !== 'submitting' && (
        <div className="flex gap-2 bg-muted rounded-full p-1">
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all',
                language === lang
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {languageNames[lang]}
            </button>
          ))}
        </div>
      )}

      {/* INITIAL STATE: Main prompt + Big mic */}
      {flowState === 'initial' && (
        <>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground text-center leading-relaxed">
            {t.mainPrompt}
          </h1>

          <Button
            size="lg"
            className="h-32 w-32 rounded-full shadow-lg transition-all"
            onClick={startRecording}
          >
            <Mic className="h-12 w-12" />
          </Button>

          <p className="text-muted-foreground text-center text-lg">
            {t.tapToSpeak}
          </p>

          <div className="flex items-center gap-4 w-full max-w-xs">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted-foreground text-sm">{t.or}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button
            variant="outline"
            size="lg"
            className="h-14 px-8 text-lg"
            onClick={() => navigate('/tasks')}
          >
            <Search className="mr-2 h-5 w-5" />
            {t.lookForWork}
          </Button>
        </>
      )}

      {/* RECORDING STATE: Pulsing button + timer */}
      {flowState === 'recording' && (
        <>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground text-center leading-relaxed">
            {t.mainPrompt}
          </h1>

          <div className="relative">
            <Button
              size="lg"
              variant="destructive"
              className="h-32 w-32 rounded-full shadow-lg animate-pulse scale-110"
              onClick={stopRecording}
            >
              <Square className="h-12 w-12" />
            </Button>

            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-lg font-medium text-destructive">
              {formatTime(recordingTime)}
            </div>
          </div>

          <p className="text-muted-foreground text-center text-lg mt-4">
            {t.tapToStop}
          </p>
        </>
      )}

      {/* PROCESSING STATE: Spinner */}
      {flowState === 'processing' && (
        <>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground text-center leading-relaxed">
            {t.mainPrompt}
          </h1>

          <div className="h-32 w-32 rounded-full bg-muted flex items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>

          <p className="text-muted-foreground text-center text-lg">
            {t.processing}
          </p>
        </>
      )}

      {/* PARSING STATE: AI analyzing */}
      {flowState === 'parsing' && (
        <>
          <h2 className="text-lg font-medium text-muted-foreground">
            {language === 'hi' ? 'समझ रहा हूं...' : language === 'bn' ? 'বুঝতেছি...' : 'Understanding...'}
          </h2>

          <div className="h-32 w-32 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>

          <p className="text-muted-foreground text-center text-lg">
            {language === 'hi' ? 'आपकी योजना को समझ रहा हूं' : language === 'bn' ? 'আপনার পরিকল্পনা বুঝতেছি' : 'Analyzing your plan'}
          </p>
        </>
      )}

      {/* REVIEW STATE: Show transcription + parsed plan + Submit/Edit options */}
      {flowState === 'review' && (
        <>
          <h2 className="text-lg font-medium text-muted-foreground">
            {t.yourPlan}
          </h2>

          {/* Parsed Plan Preview */}
          {parsedPlan && parsedPlan.confidence > 0.3 && (
            <div className="bg-primary/10 rounded-xl p-4 w-full max-w-md border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-primary">
                  {language === 'hi' ? 'आपका लक्ष्य' : language === 'bn' ? 'আপনার লক্ষ্য' : 'Your Target'}
                </span>
                <span className="text-sm bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  {getSlotLabel(parsedPlan.estimatedSlots)}
                </span>
              </div>
              <p className="text-lg font-semibold text-foreground">{parsedPlan.title}</p>
              {parsedPlan.subtasks.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {parsedPlan.subtasks.slice(0, 3).map((task, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                      {task}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {isEditing ? (
            <Textarea
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              className="w-full max-w-md text-lg min-h-[120px]"
              autoFocus
            />
          ) : (
            <div 
              className="bg-muted/50 rounded-xl p-6 w-full max-w-md cursor-pointer hover:bg-muted transition-colors"
              onClick={() => setIsEditing(true)}
            >
              <p className="text-base text-foreground leading-relaxed">
                {transcription}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {t.edit} ✏️
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 w-full max-w-md">
            <Button
              size="lg"
              className="h-14 text-lg"
              onClick={handleSubmitPlan}
              disabled={!transcription.trim()}
            >
              <Check className="mr-2 h-5 w-5" />
              {t.submitPlan}
            </Button>

            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                className="flex-1 h-12"
                onClick={handleRecordAgain}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {t.recordAgain}
              </Button>
              
              <Button
                variant="ghost"
                size="lg"
                className="h-12"
                onClick={() => navigate('/tasks')}
              >
                <Search className="mr-2 h-4 w-4" />
                {t.lookForWork}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* SUBMITTING STATE: Loading */}
      {flowState === 'submitting' && (
        <>
          <div className="h-32 w-32 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>

          <p className="text-muted-foreground text-center text-lg">
            {t.submitting}
          </p>
        </>
      )}

      {/* SUBMITTED STATE: Success + next actions */}
      {flowState === 'submitted' && (
        <>
          <div className="h-32 w-32 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-12 w-12 text-primary-foreground" />
          </div>

          <h2 className="text-2xl font-bold text-foreground text-center">
            {t.planSubmitted}
          </h2>
          
          <p className="text-muted-foreground text-center">
            {t.planActive}
          </p>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button
              size="lg"
              className="h-14"
              onClick={() => navigate('/tasks')}
            >
              {t.logProgress}
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              className="h-12"
              onClick={handleSubmitAnother}
            >
              {t.submitAnother}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

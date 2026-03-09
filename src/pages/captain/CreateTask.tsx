import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import MobileLayout from '@/components/layout/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Mic, Check, RotateCcw, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TeamMember } from '@/types';

interface ConversationMessage {
  role: 'user' | 'ai';
  text: string;
}

interface TaskDraft {
  title: string;
  description: string;
  estimatedSlots: number;
  assignedToName: string | null;
  assignedToUserId: string | null;
  isOpen: boolean;
}

type FlowState = 
  | 'team_select'
  | 'listening'
  | 'voice_detected'
  | 'processing'
  | 'ai_responding'
  | 'conversation'
  | 'submitting'
  | 'done';

// VAD constants - tunable
const SILENCE_THRESHOLD = 0.015;  // RMS threshold for detecting voice
const SILENCE_DURATION = 2000;   // 2 seconds of silence triggers processing

export default function CreateTask() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user, teamMemberships } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [flowState, setFlowState] = useState<FlowState>('team_select');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedTeamName, setSelectedTeamName] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [voiceUrl, setVoiceUrl] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lockedLanguage, setLockedLanguage] = useState<'hi' | 'bn' | 'en' | null>(null);
  const [lastAgentResponse, setLastAgentResponse] = useState<{ type: string; taskDraft?: TaskDraft } | null>(null);
  
  // CRITICAL: Refs for immediate access (React state is async!)
  const lockedLanguageRef = useRef<'hi' | 'bn' | 'en' | null>(null);
  const lastAgentResponseRef = useRef<{ type: string; taskDraft?: TaskDraft } | null>(null);
  const teamMembersRef = useRef<TeamMember[]>([]);
  const selectedTeamRef = useRef<string>('');
  
  // VAD refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isListeningRef = useRef(false);
  
  // Recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const conversationRef = useRef<ConversationMessage[]>([]);

  // Keep conversationRef in sync
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  // For backward compat, also check captainTeams if no groupId (shouldn't happen in new flow)
  const captainTeams = teamMemberships.filter(m => m.role === 'captain');

  // Auto-select group from URL params OR fallback to single captain team
  useEffect(() => {
    if (groupId) {
      // We have groupId from URL - fetch team info and start
      const fetchGroupInfo = async () => {
        const { data: teamData } = await supabase
          .from('teams')
          .select('id, name')
          .eq('id', groupId)
          .single();
        
        if (teamData) {
          handleTeamSelect(teamData.id, teamData.name);
        }
      };
      fetchGroupInfo();
    } else if (captainTeams.length === 1) {
      // Legacy: auto-select if only one captain team
      handleTeamSelect(captainTeams[0].team_id, captainTeams[0].teams.name);
    }
  }, [groupId, captainTeams.length]);

  // Scroll to bottom of conversation
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Stop all listening/recording (closes stream completely)
  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  // Pause listening temporarily (during TTS) without closing the stream
  const pauseListening = useCallback(() => {
    console.debug('Pausing VAD - AI is speaking');
    isListeningRef.current = false;
    
    // Cancel VAD animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Clear silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    // Stop any ongoing recording
    if (mediaRecorderRef.current?.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
    }
    
    // Note: DON'T close the stream or audioContext - we'll resume later
  }, []);

  // Start continuous listening with VAD
  const startContinuousListening = useCallback(async () => {
    try {
      console.debug('Starting continuous listening...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      streamRef.current = stream;
      
      // Set up Web Audio API for VAD
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);
      
      // Set up MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      
      mediaRecorderRef.current.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioChunksRef.current = [];
          // Don't close the stream - we want to keep listening
          await processRecording(blob);
        }
      };
      
      isListeningRef.current = true;
      setFlowState('listening');
      
      // Start VAD monitoring
      detectVoiceActivity();
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({ title: t.microphoneDenied, variant: 'destructive' });
    }
  }, [toast, t]);

  // Voice Activity Detection loop
  const detectVoiceActivity = useCallback(() => {
    if (!analyserRef.current || !isListeningRef.current) return;
    
    const bufferLength = analyserRef.current.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    
    const checkAudio = () => {
      if (!isListeningRef.current || !analyserRef.current) return;
      
      analyserRef.current.getByteTimeDomainData(dataArray);
      
      // Calculate RMS (Root Mean Square) for volume detection
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / bufferLength);
      
      if (rms > SILENCE_THRESHOLD) {
        // Voice detected!
        setFlowState(prev => prev === 'listening' || prev === 'voice_detected' ? 'voice_detected' : prev);
        
        // Start recording if not already
        if (mediaRecorderRef.current?.state === 'inactive') {
          console.debug('Voice detected, starting recording...');
          mediaRecorderRef.current.start();
        }
        
        // Reset silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        
      } else if (mediaRecorderRef.current?.state === 'recording') {
        // Silence while recording - start/reset 2-second timer
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            // 2 seconds of silence - stop recording and process
            if (mediaRecorderRef.current?.state === 'recording') {
              console.debug('2s silence detected, processing...');
              setFlowState('processing');
              mediaRecorderRef.current.stop();
            }
            silenceTimerRef.current = null;
          }, SILENCE_DURATION);
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(checkAudio);
    };
    
    checkAudio();
  }, []);

  // Resume listening after AI response (without closing stream)
  const resumeListening = useCallback(() => {
    if (!streamRef.current || !audioContextRef.current) {
      // Stream was closed, need to restart
      startContinuousListening();
      return;
    }
    
    // Reset MediaRecorder for next recording
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try {
        mediaRecorderRef.current?.stop();
      } catch (e) {}
    }
    
    mediaRecorderRef.current = new MediaRecorder(streamRef.current);
    audioChunksRef.current = [];
    
    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };
    
    mediaRecorderRef.current.onstop = async () => {
      if (audioChunksRef.current.length > 0) {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        await processRecording(blob);
      }
    };
    
    isListeningRef.current = true;
    setFlowState('listening');
    detectVoiceActivity();
  }, [startContinuousListening, detectVoiceActivity]);

  // Text-to-speech function - returns Promise that resolves when audio finishes
  const speakText = async (text: string, forcedLanguage?: 'hi' | 'bn' | 'en' | null): Promise<void> => {
    try {
      setIsSpeaking(true);
      console.debug('Requesting TTS for:', text.substring(0, 50), 'language:', forcedLanguage);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({ text, language: forcedLanguage })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('TTS error:', errorData);
        setIsSpeaking(false);
        return;
      }

      const data = await response.json();

      if (data.audioContent) {
        const base64 = data.audioContent;
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);

        if (audioRef.current) {
          audioRef.current.pause();
        }

        audioRef.current = new Audio(audioUrl);

        // Wait for audio to finish playing via a properly constructed Promise
        await new Promise<void>((resolve) => {
          audioRef.current!.onended = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          audioRef.current!.onerror = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          audioRef.current!.play().catch(() => {
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            resolve();
          });
        });
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error('TTS playback error:', error);
      setIsSpeaking(false);
    }
  };

  const fetchTeamMembers = async (teamId: string) => {
    const { data } = await supabase
      .from('team_memberships')
      .select('user_id, profiles(name)')
      .eq('team_id', teamId)
      .eq('status', 'active')
      .neq('user_id', user?.id);
    
    const members: TeamMember[] = (data || []).map((m: any) => ({
      user_id: m.user_id,
      name: m.profiles?.name || 'Unknown'
    }));
    
    // CRITICAL: Update BOTH ref (immediate) and state (UI)
    teamMembersRef.current = members;
    setTeamMembers(members);
    console.debug('Team members loaded:', members.length, members.map(m => m.name));
  };

  const handleTeamSelect = async (teamId: string, teamName: string) => {
    // Update BOTH state (for UI) AND ref (for immediate access in async callbacks)
    setSelectedTeam(teamId);
    selectedTeamRef.current = teamId;
    setSelectedTeamName(teamName);
    await fetchTeamMembers(teamId);
    
    // Automatically start continuous listening
    await startContinuousListening();
  };

  const processRecording = async (blob: Blob) => {
    // IMMEDIATELY pause VAD to prevent picking up any residual audio
    pauseListening();
    setFlowState('processing');
    
    // Upload voice note
    if (user && !voiceUrl) {
      const fileName = `${user.id}/${Date.now()}.webm`;
      const { data } = await supabase.storage.from('work-uploads').upload(fileName, blob);
      if (data) {
        const { data: { publicUrl } } = supabase.storage.from('work-uploads').getPublicUrl(fileName);
        setVoiceUrl(publicUrl);
      }
    }
    
    // Transcribe
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64Audio = (reader.result as string).split(',')[1];
      
      try {
        // Pass locked language to transcribe - default to Bengali
        const languageForTranscription = lockedLanguageRef.current || 'bn';
        console.debug('Transcribing with language:', languageForTranscription);
        
        const transcribeResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify({ 
            audio: base64Audio,
            language: languageForTranscription  // Pass locked language!
          })
        });
        
        const transcribeData = await transcribeResponse.json();
        const transcription = transcribeData.text || '';
        
        if (!transcription) {
          toast({ title: t.couldNotUnderstandSpeakAgain, variant: 'destructive' });
          resumeListening();
          return;
        }
        
        // Add user message to conversation
        const userMessage: ConversationMessage = { role: 'user', text: transcription };
        setConversation(prev => [...prev, userMessage]);
        
        // Lock language from first user message - USE REF FOR IMMEDIATE ACCESS
        let currentLanguage = lockedLanguageRef.current;
        if (!currentLanguage) {
          currentLanguage = detectLanguage(transcription);
          lockedLanguageRef.current = currentLanguage;  // Ref updates immediately!
          setLockedLanguage(currentLanguage);  // State for UI
          console.debug('Language locked to:', currentLanguage);
        }
        
        // Process with AI agent - PASS THE CURRENT LANGUAGE DIRECTLY
        setFlowState('ai_responding');
        await processWithAgent(transcription, [...conversationRef.current, userMessage], currentLanguage);
        
      } catch (error) {
        console.error('Error processing:', error);
        toast({ title: t.errorProcessingVoice, variant: 'destructive' });
        resumeListening();
      }
    };
  };

  const processWithAgent = async (
    transcription: string, 
    currentConversation: ConversationMessage[],
    currentLanguage: 'hi' | 'bn' | 'en'  // REQUIRED: Pass language directly
  ) => {
    try {
      // Use refs for immediate access to last response
      const lastResponse = lastAgentResponseRef.current;
      
      console.debug('Sending to agent:', {
        transcription,
        lockedLanguage: currentLanguage,
        lastResponseType: lastResponse?.type
      });

      // Use REF for team members (state might not be updated yet)
      console.debug('Sending team members from ref:', teamMembersRef.current.length);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/captain-task-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({
          transcription,
          teamMembers: teamMembersRef.current,  // USE REF, not state!
          conversationHistory: currentConversation.slice(0, -1),
          teamName: selectedTeamName,
          lockedLanguage: currentLanguage,
          lastResponseType: lastResponse?.type || null,
          lastTaskDraft: lastResponse?.taskDraft || null
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'AI processing failed');
      }
      
      const data = await response.json();
      console.debug('Agent response:', {
        type: data.type,
        textPreview: data.text?.substring(0, 80),
        hasTaskDraft: !!data.taskDraft,
        taskDraftTitle: data.taskDraft?.title,
        assignedToUserId: data.taskDraft?.assignedToUserId
      });
      
      // Save response to REF for immediate access next time
      lastAgentResponseRef.current = { type: data.type, taskDraft: data.taskDraft };
      setLastAgentResponse({ type: data.type, taskDraft: data.taskDraft });
      
      // Add AI response to conversation and speak it
      if (data.text) {
        const aiMessage: ConversationMessage = { role: 'ai', text: data.text };
        setConversation(prev => [...prev, aiMessage]);
        
        // PAUSE VAD before speaking to prevent feedback loop
        pauseListening();
        
        // AWAIT the speech to complete before proceeding
        // Pass locked language explicitly from parameter
        await speakText(data.text, currentLanguage);
      }
      
      // Update task draft if available
      if (data.taskDraft) {
        setTaskDraft(data.taskDraft);
      }
      
      // Handle response type (after speech finishes)
      if (data.type === 'confirmed') {
        // CRITICAL: Use fallback chain if data.taskDraft is missing
        const draftToUse = data.taskDraft || lastAgentResponseRef.current?.taskDraft || taskDraft;
        
        if (draftToUse && draftToUse.title) {
          await createTask(draftToUse);
        } else {
          console.error('No valid task draft for confirmation:', { 
            fromResponse: data.taskDraft, 
            fromRef: lastAgentResponseRef.current?.taskDraft, 
            fromState: taskDraft 
          });
          toast({ 
            title: t.failedToCreateTaskError, 
            description: t.taskDetailsNotFound,
            variant: 'destructive' 
          });
          stopListening();
          setTimeout(() => navigate(groupId ? `/groups/${groupId}` : '/'), 1000);
        }
      } else {
        // Resume listening for next input (with longer delay to prevent audio echo)
        setFlowState('conversation');
        setTimeout(() => {
          resumeListening();
        }, 800);  // Increased from 300ms to 800ms to let any audio echo die down
      }
      
    } catch (error) {
      console.error('Agent error:', error);
      toast({ 
        title: 'AI Error', 
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive' 
      });
      // CRITICAL: DON'T resume listening on error - navigate away to prevent infinite loop
      stopListening();
      setTimeout(() => navigate(groupId ? `/groups/${groupId}` : '/'), 1500);
    }
  };

  const createTask = async (draft: TaskDraft) => {
    // CRITICAL: Validate draft before doing anything
    if (!draft || !draft.title) {
      console.error('createTask called with invalid draft:', draft);
      toast({ 
        title: t.failedToCreateTaskError, 
        description: t.taskDetailsNotFound,
        variant: 'destructive' 
      });
      stopListening();
      setTimeout(() => navigate('/'), 1000);
      return;
    }
    
    // Use REF for immediate access (not state which may be stale in closures)
    const teamId = selectedTeamRef.current;
    
    // CRITICAL: Validate selectedTeam is a valid UUID (36 chars)
    if (!teamId || teamId.trim() === '' || teamId.length !== 36) {
      console.error('Invalid or missing team_id:', teamId);
      toast({ 
        title: t.teamNotSelected, 
        description: t.pleaseSelectTeam,
        variant: 'destructive' 
      });
      stopListening();
      setTimeout(() => navigate('/'), 1000);
      return;
    }
    
    stopListening();
    setFlowState('submitting');
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: draft.title,
          description_text: draft.description,
          voice_note_url: voiceUrl || null,
          team_id: teamId,
          created_by_user_id: user?.id,
          scheduled_date: today,
          estimated_slots: Math.ceil(draft.estimatedSlots || 1),
          type: 'captain_assigned',
          status: draft.assignedToUserId ? 'assigned' : 'open'
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Create assignment only if we have a TRULY valid UUID (36 chars)
      const hasValidAssignee = draft.assignedToUserId && 
        typeof draft.assignedToUserId === 'string' && 
        draft.assignedToUserId.trim() !== '' &&
        draft.assignedToUserId.length === 36;
        
      if (hasValidAssignee && task) {
        await supabase.from('task_assignments').insert({
          task_id: task.id,
          assigned_to_user_id: draft.assignedToUserId,
          status: 'pending'
        });
      }

      setFlowState('done');
      toast({ title: `✓ ${t.taskCreatedToast}` });
      
      // Navigate to tasks list
      setTimeout(() => navigate('/tasks'), 500);
      
    } catch (error) {
      console.error('Error creating task:', error);
      toast({ title: t.failedToCreateTaskError, variant: 'destructive' });
      // CRITICAL: DON'T resume listening - navigate away instead
      stopListening();
      setTimeout(() => navigate('/'), 1500);
    }
  };

  // Detect language from first user message
  const detectLanguage = (text: string): 'hi' | 'bn' | 'en' => {
    // Bengali Unicode range check
    if (/[অ-ঔক-হা-ৌ]/.test(text)) return 'bn';
    // Hindi/Devanagari Unicode range check  
    if (/[अ-ऑक-हा-ौ]/.test(text)) return 'hi';
    return 'en';
  };

  const resetConversation = () => {
    stopListening();
    setConversation([]);
    setTaskDraft(null);
    setVoiceUrl('');
    setLockedLanguage(null);
    setLastAgentResponse(null);
    // Also reset refs!
    lockedLanguageRef.current = null;
    lastAgentResponseRef.current = null;
    startContinuousListening();
  };

  // Render team selection - only if no groupId from URL and multiple teams
  if (flowState === 'team_select' && !groupId && captainTeams.length > 1) {
    return (
      <MobileLayout>
        <div className="p-4 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">{t.createTask}</h1>
          </div>
          
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="text-center text-muted-foreground">{t.selectTeamFirst}</p>
              <Select onValueChange={(val) => {
                const team = captainTeams.find(t => t.team_id === val);
                if (team) handleTeamSelect(val, team.teams.name);
              }}>
                <SelectTrigger className="h-14 text-base">
                  <SelectValue placeholder={t.chooseTeamPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {captainTeams.map((m) => (
                    <SelectItem key={m.team_id} value={m.team_id}>
                      {m.teams.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { stopListening(); navigate(-1); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">{t.createTask}</h1>
            {selectedTeamName && (
              <p className="text-sm text-muted-foreground">{selectedTeamName}</p>
            )}
          </div>
          {conversation.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-auto gap-1.5"
              onClick={resetConversation}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="text-xs">{t.startOver}</span>
            </Button>
          )}
        </div>

        {/* Conversation area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {conversation.length === 0 && flowState !== 'processing' && (
            <div className="text-center py-8">
              <p className="text-lg text-muted-foreground mb-2">
                {t.justSpeakNaturally}
              </p>
              <p className="text-sm text-muted-foreground">
                {t.sayWhoWhatHowLong}
              </p>
              {teamMembers.length > 0 && (
                <p className="text-xs text-muted-foreground mt-4">
                  {t.teamLabel} {teamMembers.map(m => m.name).join(', ')}
                </p>
              )}
            </div>
          )}

          {conversation.map((msg, idx) => (
            <div 
              key={idx} 
              className={cn(
                "max-w-[85%] p-3 rounded-2xl",
                msg.role === 'user' 
                  ? "ml-auto bg-primary text-primary-foreground rounded-br-md"
                  : "mr-auto bg-muted rounded-bl-md"
              )}
            >
              <div className="flex items-start gap-2">
                <p className="text-sm whitespace-pre-wrap flex-1">{msg.text}</p>
                {msg.role === 'ai' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => speakText(msg.text)}
                    disabled={isSpeaking}
                  >
                    <Volume2 className={cn("h-4 w-4", isSpeaking && "animate-pulse text-primary")} />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {flowState === 'processing' && (
            <div className="mr-auto bg-muted p-3 rounded-2xl rounded-bl-md">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {isSpeaking && (
            <div className="mr-auto bg-primary/10 border border-primary/20 px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-3 animate-fade-in">
              <div className="flex items-center gap-1 h-6">
                <span className="w-1 bg-primary rounded-full animate-sound-wave" style={{ animationDelay: '0ms' }} />
                <span className="w-1 bg-primary rounded-full animate-sound-wave" style={{ animationDelay: '150ms' }} />
                <span className="w-1 bg-primary rounded-full animate-sound-wave" style={{ animationDelay: '300ms' }} />
                <span className="w-1 bg-primary rounded-full animate-sound-wave" style={{ animationDelay: '450ms' }} />
              </div>
              <span className="text-sm text-primary font-medium">{t.speaking}</span>
            </div>
          )}

          {flowState === 'submitting' && (
            <div className="text-center py-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-2">{t.creatingTaskDots}</p>
            </div>
          )}

          {flowState === 'done' && (
            <div className="text-center py-8">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <p className="text-lg font-medium">{t.taskCreatedSuccess}</p>
            </div>
          )}

          <div ref={conversationEndRef} />
        </div>

        {/* Bottom visual indicator - no tap required! */}
        {flowState !== 'submitting' && flowState !== 'done' && (
          <div className="p-6 border-t border-border bg-background">
            <div className="flex flex-col items-center gap-3">
              {/* Visual state indicator */}
              <div className={cn(
                "h-20 w-20 rounded-full flex items-center justify-center transition-all duration-300",
                flowState === 'listening' && "bg-primary/20",
                flowState === 'voice_detected' && "bg-destructive scale-110",
                flowState === 'processing' && "bg-amber-500",
                flowState === 'ai_responding' && "bg-primary/30",
                flowState === 'conversation' && "bg-primary/20"
              )}>
                {flowState === 'processing' || flowState === 'ai_responding' ? (
                  <Loader2 className="h-8 w-8 animate-spin text-primary-foreground" />
                ) : flowState === 'voice_detected' ? (
                  <Volume2 className="h-8 w-8 text-destructive-foreground animate-pulse" />
                ) : (
                  <Mic className={cn(
                    "h-8 w-8 text-primary",
                    flowState === 'listening' && "animate-pulse"
                  )} />
                )}
              </div>
              
              <p className="text-sm text-muted-foreground text-center">
                {isSpeaking
                  ? t.aiIsSpeaking
                  : flowState === 'voice_detected'
                    ? t.speaking
                    : flowState === 'processing'
                      ? t.processing
                      : flowState === 'ai_responding'
                        ? t.aiIsThinking
                        : t.listeningJustSpeakNaturally}
              </p>
              
              {/* Small hint text */}
              {(flowState === 'listening' || flowState === 'conversation') && (
                <p className="text-xs text-muted-foreground/70">
                  {t.secondPauseNextStep}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}

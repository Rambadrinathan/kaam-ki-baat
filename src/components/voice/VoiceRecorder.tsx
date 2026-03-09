import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import { useAudioRecording } from '@/hooks/useAudioRecording';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, transcription: string) => void;
  isTranscribing?: boolean;
  className?: string;
  language?: string;
}

export default function VoiceRecorder({
  onRecordingComplete,
  isTranscribing = false,
  className,
  language = 'en'
}: VoiceRecorderProps) {
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { t } = useLanguage();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { isRecording, recordingTime, startRecording, stopRecording, formatTime } = useAudioRecording({
    onRecordingComplete: (blob) => {
      setAudioBlob(blob);
    },
  });

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handleStartRecording = async () => {
    try {
      await startRecording();
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const transcribeAndSubmit = async () => {
    if (!audioBlob) return;

    // Convert blob to base64
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      const base64Audio = (reader.result as string).split(',')[1];

      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify({ audio: base64Audio, language })
        });

        const data = await response.json();

        if (data.error) {
          console.error('Transcription error:', data.error);
          onRecordingComplete(audioBlob, '');
        } else {
          onRecordingComplete(audioBlob, data.text || '');
        }
      } catch (error) {
        console.error('Error transcribing:', error);
        onRecordingComplete(audioBlob, '');
      }
    };
  };

  const playAudio = () => {
    if (!audioBlob) return;

    if (audioRef.current) {
      audioRef.current.pause();
    }

    audioRef.current = new Audio(URL.createObjectURL(audioBlob));
    audioRef.current.onended = () => setIsPlaying(false);
    audioRef.current.play();
    setIsPlaying(true);
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {!audioBlob ? (
        <>
          <div className="relative">
            <Button
              type="button"
              size="lg"
              variant={isRecording ? "destructive" : "default"}
              className={cn(
                "h-20 w-20 rounded-full",
                isRecording && "animate-pulse"
              )}
              onClick={isRecording ? stopRecording : handleStartRecording}
            >
              {isRecording ? (
                <Square className="h-8 w-8" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </Button>
            {isRecording && (
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-sm font-medium text-destructive">
                {formatTime(recordingTime)}
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isRecording ? t.tapToStopRecording : t.tapToStartRecording}
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={isPlaying ? pauseAudio : playAudio}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            <span className="text-sm text-muted-foreground">
              {formatTime(recordingTime)} {t.recorded}
            </span>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={resetRecording}
              disabled={isTranscribing}
            >
              {t.reRecord}
            </Button>
            <Button
              type="button"
              onClick={transcribeAndSubmit}
              disabled={isTranscribing}
            >
              {isTranscribing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.transcribing}
                </>
              ) : (
                t.useRecording
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

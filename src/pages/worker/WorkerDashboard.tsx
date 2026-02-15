import { useAuth } from '@/hooks/useAuth';
import MobileLayout from '@/components/layout/MobileLayout';
import VoicePrompt from '@/components/voice/VoicePrompt';
import { Loader2 } from 'lucide-react';

export default function WorkerDashboard() {
  const { loading: authLoading } = useAuth();

  if (authLoading) {
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
      <VoicePrompt />
    </MobileLayout>
  );
}

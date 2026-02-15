import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import MobileLayout from '@/components/layout/MobileLayout';
import PhotoUpload from '@/components/upload/PhotoUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function EditTask() {
  const { taskId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const passedTask = location.state?.task;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedSlots, setEstimatedSlots] = useState('1');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(!passedTask);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (passedTask) {
      setTitle(passedTask.title || '');
      setDescription(passedTask.description_text || '');
      setEstimatedSlots(String(passedTask.estimated_slots || 1));
      setImageUrl(passedTask.image_url || '');
    } else if (taskId) {
      fetchTask();
    }
  }, [taskId, passedTask]);

  const fetchTask = async () => {
    if (!taskId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (error) throw error;
      
      // Check permissions
      if (data.created_by_user_id !== user?.id || data.type !== 'self_proposed' || data.status === 'completed') {
        toast({
          title: t.cannotEdit,
          description: t.onlyEditOwnTasks,
          variant: 'destructive'
        });
        navigate(-1);
        return;
      }

      setTitle(data.title);
      setDescription(data.description_text || '');
      setEstimatedSlots(String(data.estimated_slots));
      setImageUrl(data.image_url || '');
    } catch (error: any) {
      toast({
        title: t.errorLoadingTask,
        description: error.message,
        variant: 'destructive'
      });
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: t.titleRequired,
        description: t.pleaseEnterTaskTitle,
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: title.trim(),
          description_text: description.trim() || null,
          estimated_slots: parseInt(estimatedSlots),
          image_url: imageUrl || null
        })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: t.taskUpdated,
        description: t.changesSaved
      });

      navigate(`/tasks/${taskId}`);
    } catch (error: any) {
      toast({
        title: t.errorSaving,
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MobileLayout title={t.editTask} showBackButton>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title={t.editTask} showBackButton>
      <div className="p-4 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t.taskTitle}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.whatWillYouWorkOn}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t.taskDescription}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.describePlanDots}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slots">{t.estimatedTime}</Label>
              <Select value={estimatedSlots} onValueChange={setEstimatedSlots}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t.hours2}</SelectItem>
                  <SelectItem value="2">{t.hours4}</SelectItem>
                  <SelectItem value="3">{t.hours6}</SelectItem>
                  <SelectItem value="4">{t.hours8FullDay}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t.photoOptional}</Label>
              <PhotoUpload 
                onUploadComplete={setImageUrl}
                existingUrl={imageUrl}
              />
            </div>
          </CardContent>
        </Card>

        <Button 
          className="w-full h-12"
          onClick={handleSave}
          disabled={saving || !title.trim()}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t.saveChanges}
        </Button>
      </div>
    </MobileLayout>
  );
}

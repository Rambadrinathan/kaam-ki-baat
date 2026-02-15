import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import MobileLayout from '@/components/layout/MobileLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function CreateTeam() {
  const { user, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fullScoreValue, setFullScoreValue] = useState('500');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({
        title: t.nameRequiredShort,
        description: t.pleaseEnterName,
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          full_score_value: parseInt(fullScoreValue) || 500,
          created_by_user_id: user?.id
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Add creator as captain
      const { error: membershipError } = await supabase
        .from('team_memberships')
        .insert({
          team_id: team.id,
          user_id: user?.id,
          role: 'captain',
          status: 'active'
        });

      if (membershipError) throw membershipError;

      // Refresh auth context to include new team membership
      await refreshProfile();

      toast({
        title: t.teamCreated,
        description: `${name} ${t.teamCreatedHint}`
      });

      navigate(`/groups/${team.id}`);
    } catch (error) {
      console.error('Error creating team:', error);
      toast({
        title: t.error,
        description: t.failedToCreateTeam,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">{t.createTeamTitle}</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.teamDetails}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t.teamNameRequired}</Label>
              <Input
                id="name"
                placeholder={t.teamNamePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t.descriptionOptional}</Label>
              <Textarea
                id="description"
                placeholder={t.descriptionPlaceholder}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">{t.fullScoreValue} (₹)</Label>
              <Input
                id="value"
                type="number"
                placeholder="500"
                value={fullScoreValue}
                onChange={(e) => setFullScoreValue(e.target.value)}
                className="h-12"
              />
              <p className="text-xs text-muted-foreground">
                {t.fullScoreHint}
              </p>
            </div>
          </CardContent>
        </Card>

        <Button 
          className="w-full h-14 text-base"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t.creating}
            </>
          ) : (
            t.createTeamTitle
          )}
        </Button>
      </div>
    </MobileLayout>
  );
}

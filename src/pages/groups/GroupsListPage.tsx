import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import MobileLayout from '@/components/layout/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Users, ChevronRight, Crown, UserPlus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GroupInfo {
  id: string;
  team_id: string;
  role: 'captain' | 'vice_captain' | 'member';
  teams: {
    id: string;
    name: string;
    full_score_value: number;
  };
  pendingTasks: number;
  memberCount: number;
}

export default function GroupsListPage() {
  const { user, teamMemberships, loading: authLoading, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (user && teamMemberships) {
      fetchGroupDetails();
    }
  }, [user, teamMemberships]);

  const fetchGroupDetails = async () => {
    if (!teamMemberships || teamMemberships.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }

    try {
      // Get member counts and pending tasks for each group
      const groupsWithDetails = await Promise.all(
        teamMemberships.map(async (membership) => {
          // Get member count
          const { count: memberCount } = await supabase
            .from('team_memberships')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', membership.team_id)
            .eq('status', 'active');

          // Get pending/active tasks count
          const { count: pendingTasks } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', membership.team_id)
            .in('status', ['open', 'in_progress', 'pending_approval']);

          return {
            id: membership.id,
            team_id: membership.team_id,
            role: membership.role,
            teams: membership.teams,
            pendingTasks: pendingTasks || 0,
            memberCount: memberCount || 0,
          };
        })
      );

      setGroups(groupsWithDetails);
    } catch (error) {
      console.error('Error fetching group details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (code.length !== 6) {
      toast({
        title: t.invalidCode,
        description: t.enterValidCode,
        variant: 'destructive'
      });
      return;
    }

    setJoining(true);
    try {
      // Find team by invite code
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('id, name')
        .eq('invite_code', code)
        .maybeSingle();

      if (teamError) throw teamError;

      if (!team) {
        toast({
          title: t.invalidCode,
          description: t.noGroupFound,
          variant: 'destructive'
        });
        return;
      }

      // Check if already a member
      const { data: existingMembership } = await supabase
        .from('team_memberships')
        .select('id')
        .eq('team_id', team.id)
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .maybeSingle();

      if (existingMembership) {
        toast({
          title: t.alreadyMember,
          description: `${t.alreadyInGroup} ${team.name}`,
          variant: 'destructive'
        });
        return;
      }

      // Join the team
      const { error: joinError } = await supabase
        .from('team_memberships')
        .insert({
          team_id: team.id,
          user_id: user?.id,
          role: 'member',
          status: 'active'
        });

      if (joinError) throw joinError;

      toast({
        title: t.joined,
        description: `${t.youveJoined} ${team.name}`
      });

      setJoinDialogOpen(false);
      setInviteCode('');
      await refreshProfile();
    } catch (error) {
      console.error('Error joining group:', error);
      toast({
        title: t.error,
        description: t.failedToJoin,
        variant: 'destructive'
      });
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  const isAdmin = (role: string) => role === 'captain' || role === 'vice_captain';

  return (
    <MobileLayout>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t.groups}</h1>
          <div className="flex gap-2">
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="default" className="h-12 text-base px-4">
                  <UserPlus className="h-6 w-6 mr-2" />
                  {t.join}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t.joinAGroup}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    {t.enterInviteCodeHint}
                  </p>
                  <Input
                    placeholder={t.enterInviteCode}
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="h-12 text-center text-lg font-mono tracking-widest"
                  />
                  <Button 
                    className="w-full h-12"
                    onClick={handleJoinGroup}
                    disabled={joining || inviteCode.length !== 6}
                  >
                    {joining ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t.joining}
                      </>
                    ) : (
                      t.joinGroup
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button onClick={() => navigate('/groups/create')} size="default" className="h-12 text-base px-4">
              <Plus className="h-6 w-6 mr-2" />
              {t.new}
            </Button>
          </div>
        </div>

        {/* Groups List */}
        {groups.length > 0 ? (
          <div className="space-y-3">
            {groups.map((group) => (
              <Card
                key={group.id}
                className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
                onClick={() => navigate(`/groups/${group.team_id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="h-8 w-8 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xl font-bold truncate">{group.teams.name}</p>
                          {isAdmin(group.role) && (
                            <Crown className="h-7 w-7 text-amber-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-lg text-muted-foreground mt-1 font-medium">
                          <span>{group.memberCount} {t.members}</span>
                          {group.pendingTasks > 0 && (
                            <span className="text-primary font-semibold">
                              {group.pendingTasks} {t.active}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-7 w-7 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* Empty State */
          <Card className="mt-8">
            <CardContent className="p-8 text-center">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">{t.noGroupsYet}</h2>
              <p className="text-lg text-muted-foreground mb-6">
                {t.createGroupDescription}
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={() => navigate('/groups/create')} className="h-12 text-base">
                  <Plus className="h-6 w-6 mr-2" />
                  {t.createFirstGroup}
                </Button>
                <Button variant="outline" onClick={() => setJoinDialogOpen(true)} className="h-12 text-base">
                  <UserPlus className="h-6 w-6 mr-2" />
                  {t.joinWithCode}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
}

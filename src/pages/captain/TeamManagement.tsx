import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import MobileLayout from '@/components/layout/MobileLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, UserPlus, Users, Crown, Star, Trash2, Clock, Copy, Check } from 'lucide-react';
import { TeamMembership } from '@/types';

interface PendingInvitation {
  id: string;
  phone: string;
  name: string;
  role: 'captain' | 'vice_captain' | 'member';
  created_at: string;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  full_score_value: number;
  invite_code: string | null;
}

export default function TeamManagement() {
  const { teamId, groupId } = useParams();
  const [searchParams] = useSearchParams();
  const actualGroupId = groupId || teamId;
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMembership[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'member' | 'vice_captain'>('member');
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (actualGroupId) {
      fetchTeamData();
    }
  }, [actualGroupId]);

  useEffect(() => {
    if (searchParams.get('addMember') === 'true' && !loading) {
      setAddDialogOpen(true);
    }
  }, [searchParams, loading]);

  const fetchTeamData = async () => {
    try {
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', actualGroupId)
        .single();

      if (teamError) throw teamError;
      setTeam(teamData);

      const { data: membersData, error: membersError } = await supabase
        .from('team_memberships')
        .select('id, user_id, role, status')
        .eq('team_id', actualGroupId)
        .eq('status', 'active');

      if (membersError) throw membersError;

      const membersWithProfiles = await Promise.all(
        (membersData || []).map(async (member) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, phone')
            .eq('user_id', member.user_id)
            .single();

          return {
            ...member,
            profiles: profile || { name: 'Unknown', phone: null }
          } as TeamMembership;
        })
      );

      setMembers(membersWithProfiles);

      const { data: invitationsData } = await supabase
        .from('pending_invitations')
        .select('*')
        .eq('team_id', actualGroupId);

      setPendingInvitations((invitationsData || []) as PendingInvitation[]);
    } catch (error) {
      console.error('Error fetching team:', error);
      toast({
        title: t.error,
        description: t.failedToLoadTeam,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const addMember = async () => {
    const cleanPhone = newMemberPhone.trim().replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      toast({
        title: t.invalidNumber,
        description: t.enterValidMobile,
        variant: 'destructive'
      });
      return;
    }

    if (!newMemberName.trim()) {
      toast({
        title: t.nameRequiredShort,
        description: t.enterMemberName,
        variant: 'destructive'
      });
      return;
    }

    setAdding(true);

    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('user_id, name')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (existingProfile) {
        const { data: existingMembership } = await supabase
          .from('team_memberships')
          .select('id')
          .eq('team_id', actualGroupId)
          .eq('user_id', existingProfile.user_id)
          .eq('status', 'active')
          .maybeSingle();

        if (existingMembership) {
          toast({
            title: t.alreadyMember,
            description: `${existingProfile.name} ${t.alreadyInGroup}`,
            variant: 'destructive'
          });
          return;
        }

        const { error } = await supabase
          .from('team_memberships')
          .insert({
            team_id: actualGroupId,
            user_id: existingProfile.user_id,
            role: newMemberRole,
            status: 'active'
          });

        if (error) throw error;

        toast({
          title: t.memberAdded,
          description: `${existingProfile.name} ${t.hasBeenAdded}`
        });

        fetchTeamData();
      } else {
        const { error } = await supabase
          .from('pending_invitations')
          .upsert({
            team_id: actualGroupId,
            phone: cleanPhone,
            name: newMemberName.trim(),
            role: newMemberRole,
            invited_by_user_id: user?.id
          }, {
            onConflict: 'team_id,phone'
          });

        if (error) throw error;

        toast({
          title: t.invitationSaved,
          description: `${newMemberName} ${t.willSeeGroup}`
        });

        fetchTeamData();
      }

      setAddDialogOpen(false);
      setNewMemberPhone('');
      setNewMemberName('');
      setNewMemberRole('member');
    } catch (error) {
      console.error('Error adding member:', error);
      toast({
        title: t.error,
        description: t.failedToAdd,
        variant: 'destructive'
      });
    } finally {
      setAdding(false);
    }
  };

  const updateMemberRole = async (memberId: string, newRole: 'captain' | 'vice_captain' | 'member') => {
    try {
      const { error } = await supabase
        .from('team_memberships')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      setMembers(members.map(m => 
        m.id === memberId ? { ...m, role: newRole } : m
      ));

      toast({
        title: t.roleUpdated,
        description: t.roleChanged
      });
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: t.error,
        description: t.failedToUpdateRole,
        variant: 'destructive'
      });
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('team_memberships')
        .update({ status: 'inactive' })
        .eq('id', memberId);

      if (error) throw error;

      setMembers(members.filter(m => m.id !== memberId));

      toast({
        title: t.memberRemoved,
        description: t.removedFromTeam
      });
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: t.error,
        description: t.failedToRemove,
        variant: 'destructive'
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'captain':
        return <Crown className="h-4 w-4 text-primary" />;
      case 'vice_captain':
        return <Star className="h-4 w-4 text-warning" />;
      default:
        return null;
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

  if (!team) {
    return (
      <MobileLayout>
        <div className="p-4">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">{t.teamNotFound}</p>
              <Button onClick={() => navigate('/')} className="mt-4">
                {t.goHome}
              </Button>
            </CardContent>
          </Card>
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
            <h1 className="text-xl font-bold">{team.name}</h1>
            <p className="text-sm text-muted-foreground">
              {members.length} {members.length !== 1 ? t.members : t.member}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.teamSettings}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t.fullScoreValue}</span>
                <span className="font-medium">₹{team.full_score_value}</span>
              </div>
              {team.description && (
                <p className="text-sm text-muted-foreground">{team.description}</p>
              )}
              
              {team.invite_code && (
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-muted-foreground">{t.inviteCode}</span>
                      <p className="font-mono text-lg font-bold tracking-widest">{team.invite_code}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(team.invite_code || '');
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                        toast({
                          title: t.copied,
                          description: t.codeCopied
                        });
                      }}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.shareCodeHint}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t.teamMembers}
            </h2>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-1" />
                  {t.add}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t.addTeamMember}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t.mobileNumber}</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="9876543210"
                      maxLength={10}
                      value={newMemberPhone}
                      onChange={(e) => setNewMemberPhone(e.target.value.replace(/\D/g, ''))}
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">{t.name}</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder={t.enterName}
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">{t.role}</Label>
                    <Select value={newMemberRole} onValueChange={(v) => setNewMemberRole(v as 'member' | 'vice_captain')}>
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">{t.memberWorker}</SelectItem>
                        <SelectItem value="vice_captain">{t.viceCaptain}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="w-full h-12"
                    onClick={addMember}
                    disabled={adding}
                  >
                    {adding ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t.adding}
                      </>
                    ) : (
                      t.addMember
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-2">
            {members.map((member) => (
              <Card key={member.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-lg font-medium">
                          {member.profiles.name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{member.profiles.name}</p>
                          {getRoleIcon(member.role)}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {member.role === 'captain' ? t.captain : member.role === 'vice_captain' ? t.viceCaptain : t.member}
                        </Badge>
                      </div>
                    </div>
                    {member.user_id !== user?.id && (
                      <div className="flex items-center gap-2">
                        <Select 
                          value={member.role} 
                          onValueChange={(v) => updateMemberRole(member.id, v as 'captain' | 'vice_captain' | 'member')}
                        >
                          <SelectTrigger className="h-8 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">{t.member}</SelectItem>
                            <SelectItem value="vice_captain">{t.viceCaptain}</SelectItem>
                            <SelectItem value="captain">{t.captainAdmin}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeMember(member.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {pendingInvitations.map((invite) => (
              <Card key={invite.id} className="border-dashed">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-muted-foreground">{invite.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {t.pending}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{invite.phone}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}

import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import MobileLayout from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, ChevronRight, User, Shield, Bell, Plus, Crown } from 'lucide-react';

export default function ProfilePage() {
  const { profile, user, teamMemberships, isCaptain, isAdmin, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'captain':
        return t.captain;
      case 'vice_captain':
        return t.viceCaptain;
      default:
        return t.member;
    }
  };

  return (
    <MobileLayout title={t.profile}>
      <div className="p-4 space-y-6">
        {/* Profile Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {profile?.name ? getInitials(profile.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-bold">{profile?.name || 'User'}</h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                      <Crown className="h-3 w-3" />
                      {t.admin}
                    </span>
                  )}
                  {isCaptain && (
                    <span className="inline-flex items-center gap-1 text-xs text-primary">
                      <Shield className="h-3 w-3" />
                      {t.captain}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Access */}
        {isAdmin && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground px-1">{t.admin}</h3>
            <Card>
              <CardContent className="p-0">
                <button 
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  onClick={() => navigate('/admin')}
                >
                  <div className="flex items-center gap-3">
                    <Crown className="h-5 w-5 text-amber-600" />
                    <span className="font-medium">{t.masterAdminDashboard}</span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Teams */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground px-1">{t.teams}</h3>
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {teamMemberships.length > 0 ? (
                teamMemberships.map((membership) => (
                  <div
                    key={membership.id}
                    className="flex items-center justify-between p-4"
                  >
                    <div>
                      <p className="font-medium">{membership.teams.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getRoleDisplay(membership.role)}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      ₹{membership.teams.full_score_value}/{t.tasks.toLowerCase().charAt(0) === 'd' ? 'দিন' : 'day'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center">
                  <p className="text-muted-foreground text-sm">{t.noTeamsYet}</p>
                </div>
              )}
              
              {/* Create Team Button */}
              <button 
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-t border-border"
                onClick={() => navigate('/team/create')}
              >
                <div className="flex items-center gap-3">
                  <Plus className="h-5 w-5 text-primary" />
                  <span className="text-primary font-medium">{t.createATeam}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Settings */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground px-1">{t.settings}</h3>
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              <button className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <span>{t.editProfile}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
              
              <button className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <span>{t.notifications}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Sign Out */}
        <Button 
          variant="outline" 
          className="w-full h-12"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-5 w-5" />
          {t.signOut}
        </Button>

        {/* Version */}
        <p className="text-center text-xs text-muted-foreground">
          Kaam Ki Baat v1.0.0
        </p>
      </div>
    </MobileLayout>
  );
}

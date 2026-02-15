import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import MobileLayout from '@/components/layout/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Plus, ChevronRight } from 'lucide-react';

export default function TeamList() {
  const { teamMemberships, isCaptain } = useAuth();
  const navigate = useNavigate();

  const captainTeams = teamMemberships.filter(m => m.role === 'captain');
  const memberTeams = teamMemberships.filter(m => m.role !== 'captain');

  return (
    <MobileLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Teams</h1>
          {isCaptain && (
            <Button onClick={() => navigate('/team/create')}>
              <Plus className="h-4 w-4 mr-1" />
              Create
            </Button>
          )}
        </div>

        {captainTeams.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              Teams You Captain
            </h2>
            {captainTeams.map((membership) => (
              <Card 
                key={membership.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/team/${membership.team_id}`)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{membership.teams.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ₹{membership.teams.full_score_value}/day at full score
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {memberTeams.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              Teams You're In
            </h2>
            {memberTeams.map((membership) => (
              <Card key={membership.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{membership.teams.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {membership.role.replace('_', ' ')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {teamMemberships.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="font-medium">No teams yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isCaptain 
                  ? 'Create a team to get started'
                  : 'Ask your captain to add you to a team'
                }
              </p>
              {isCaptain && (
                <Button onClick={() => navigate('/team/create')} className="mt-4">
                  <Plus className="h-4 w-4 mr-1" />
                  Create Team
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
}

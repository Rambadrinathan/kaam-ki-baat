import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  estimatedSlots: number;
  scheduledDate: string;
  status: string;
  type: 'captain_assigned' | 'self_proposed';
  assigneeName?: string;
  onClick?: () => void;
}

const statusColors: Record<string, string> = {
  open: 'bg-secondary text-secondary-foreground',
  pending_approval: 'bg-warning/20 text-warning',
  assigned: 'bg-primary/20 text-primary',
  in_progress: 'bg-primary text-primary-foreground',
  completed: 'bg-success/20 text-success',
  cancelled: 'bg-destructive/20 text-destructive',
  rejected: 'bg-destructive/20 text-destructive',
};

const statusLabels: Record<string, string> = {
  open: 'Available',
  pending_approval: 'Pending Approval',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

export default function TaskCard({
  title,
  description,
  imageUrl,
  estimatedSlots,
  scheduledDate,
  status,
  type,
  assigneeName,
  onClick
}: TaskCardProps) {
  const formattedDate = new Date(scheduledDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short'
  });

  return (
    <Card 
      className={cn(
        "overflow-hidden transition-shadow",
        onClick && "cursor-pointer hover:shadow-md"
      )}
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="flex gap-4 p-5">
          {imageUrl ? (
            <div className="h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
              <img 
                src={imageUrl} 
                alt={title}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="h-20 w-20 flex-shrink-0 rounded-lg bg-muted flex items-center justify-center">
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xl font-bold text-foreground line-clamp-1">{title}</h3>
                <Badge 
                  variant="secondary" 
                  className={cn("flex-shrink-0 text-base font-semibold px-3 py-1", statusColors[status])}
                >
                  {statusLabels[status]}
                </Badge>
              </div>
            
            {description && (
              <p className="text-lg text-muted-foreground mt-1.5 line-clamp-2">
                {description}
              </p>
            )}
            
            <div className="flex items-center gap-4 mt-3 text-base text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-5 w-5" />
                {formattedDate}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-5 w-5" />
                {estimatedSlots} slot{estimatedSlots > 1 ? 's' : ''}
              </span>
              {assigneeName && (
                <span className="flex items-center gap-1.5">
                  <User className="h-5 w-5" />
                  {assigneeName}
                </span>
              )}
            </div>
            
            {type === 'self_proposed' && (
              <Badge variant="outline" className="mt-3 text-base font-semibold">
                Self-proposed
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

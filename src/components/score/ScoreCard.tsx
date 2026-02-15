import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ScoreCardProps {
  score: number;
  maxScore?: number;
  label: string;
  earnings?: number;
  size?: 'sm' | 'md' | 'lg';
  showEarnings?: boolean;
}

export default function ScoreCard({ 
  score, 
  maxScore = 10, 
  label, 
  earnings,
  size = 'md',
  showEarnings = true 
}: ScoreCardProps) {
  const percentage = (score / maxScore) * 100;
  
  const getScoreColor = () => {
    if (percentage >= 80) return 'text-primary';
    if (percentage >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-6xl'
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <span className={cn("font-bold", sizeClasses[size], getScoreColor())}>
            {score}
          </span>
          <span className="text-muted-foreground mb-1">/ {maxScore}</span>
        </div>
        
        {showEarnings && earnings !== undefined && (
          <p className="text-sm text-muted-foreground mt-2">
            Earnings: <span className="font-medium text-foreground">₹{earnings.toFixed(0)}</span>
          </p>
        )}
        
        {/* Progress bar */}
        <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all",
              percentage >= 80 ? 'bg-primary' : percentage >= 60 ? 'bg-warning' : 'bg-destructive'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

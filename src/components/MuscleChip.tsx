import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getMuscleGroupById } from '../db/muscles';

interface MuscleChipProps {
  muscleId: string;
  type?: 'primary' | 'secondary';
  onRemove?: () => void;
}

export function MuscleChip({ muscleId, type = 'primary', onRemove }: MuscleChipProps) {
  const muscle = getMuscleGroupById(muscleId);
  if (!muscle) return null;

  return (
    <Badge
      variant={type === 'primary' ? 'default' : 'secondary'}
      className={cn(
        'gap-1 rounded-full',
        type === 'primary' && 'bg-primary/20 text-primary hover:bg-primary/30',
        type === 'secondary' && 'bg-secondary text-muted-foreground hover:bg-secondary/80',
      )}
    >
      {muscle.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded-full hover:text-foreground"
          aria-label={`Verwijder ${muscle.name}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}

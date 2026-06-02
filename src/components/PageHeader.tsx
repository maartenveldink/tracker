import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  title: string;
  backTo?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, backTo, actions }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
      {backTo && (
        <Button
          variant="ghost"
          size="icon"
          className="-ml-1 h-8 w-8 text-muted-foreground"
          onClick={() => navigate(backTo)}
          aria-label="Terug"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}
      <h1 className="text-lg font-semibold flex-1 truncate">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

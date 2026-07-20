import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

/**
 * Shows an unobtrusive banner when a new version of the app is available,
 * letting the user refresh on their own terms instead of a silent auto-update.
 */
export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-[60] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
        <span className="text-sm">Er is een nieuwe versie beschikbaar.</span>
        <Button size="sm" onClick={() => updateServiceWorker(true)}>
          <RefreshCw className="h-4 w-4" />
          Vernieuwen
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => setNeedRefresh(false)}
        >
          Later
        </Button>
      </div>
    </div>
  );
}

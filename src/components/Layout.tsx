import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Dumbbell,
  ClipboardList,
  Play,
  TrendingUp,
  Settings,
  ListChecks,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

/** Primary, daily destinations that stay in the bottom bar. */
const navItems = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/start', label: 'Train', icon: Play },
  { to: '/habits', label: 'Habits', icon: ListChecks },
  { to: '/progress', label: 'Progressie', icon: TrendingUp },
];

/** Secondary destinations, reached via the "Meer" menu. */
const moreItems = [
  { to: '/exercises', label: 'Oefeningen', icon: Dumbbell },
  { to: '/schemas', label: "Schema's", icon: ClipboardList },
  { to: '/settings', label: 'Instellingen', icon: Settings },
];

const navItemClass = (isActive: boolean) =>
  cn(
    'flex-1 py-3 flex flex-col items-center gap-0.5 text-xs font-medium transition-colors',
    isActive ? 'text-primary bg-accent/50' : 'text-muted-foreground hover:text-foreground',
  );

export function Layout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const moreActive = moreItems.some(
    item => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  );

  function openMoreItem(to: string) {
    setMoreOpen(false);
    navigate(to);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 pb-16">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around safe-bottom z-50">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => navItemClass(isActive)}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={navItemClass(moreActive)}
          aria-label="Meer"
        >
          <MoreHorizontal className="h-5 w-5" />
          Meer
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Meer</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1">
            {moreItems.map(item => {
              const active =
                location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              return (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => openMoreItem(item.to)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors',
                    active ? 'text-primary bg-accent/50' : 'hover:bg-accent',
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

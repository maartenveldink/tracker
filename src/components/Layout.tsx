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
    'flex min-h-touch flex-1 flex-col items-center justify-center gap-1 text-nav transition-colors',
    isActive ? 'font-semibold text-accent' : 'font-normal text-muted hover:text-text',
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
      <main className="mx-auto w-full max-w-column flex-1 pb-[calc(var(--size-nav)+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-50 box-content flex h-nav justify-around border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => navItemClass(isActive)}
          >
            <item.icon className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={navItemClass(moreActive)}
          aria-label="Meer"
        >
          <MoreHorizontal className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
          Meer
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Meer</SheetTitle>
          </SheetHeader>
          <div className="mt-3 space-y-2">
            {moreItems.map(item => {
              const active =
                location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              return (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => openMoreItem(item.to)}
                  className={cn(
                    'flex min-h-[60px] w-full items-center gap-3 rounded-button border bg-bg px-3.5 text-body-lg font-semibold transition-colors hover:bg-line/40',
                    active && 'border-accent',
                  )}
                >
                  <item.icon className="h-[22px] w-[22px] shrink-0 text-accent" strokeWidth={1.75} aria-hidden="true" />
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

import { NavLink, Outlet } from 'react-router-dom';
import { Home, Dumbbell, ClipboardList, Play, TrendingUp, Apple, CalendarDays, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '../hooks/useSettings';

const navItems = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/exercises', label: 'Oefeningen', icon: Dumbbell },
  { to: '/schemas', label: "Schema's", icon: ClipboardList },
  { to: '/start', label: 'Train', icon: Play },
  { to: '/nutrition', label: 'Voeding', icon: Apple, feature: 'nutrition' as const },
  { to: '/planner', label: 'Planner', icon: CalendarDays, feature: 'planner' as const },
  { to: '/progress', label: 'Progressie', icon: TrendingUp },
  { to: '/settings', label: 'Instellingen', icon: Settings },
];

export function Layout() {
  const settings = useSettings();
  const visibleNavItems = navItems.filter(
    item => !item.feature || settings.features[item.feature],
  );

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 pb-16">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around safe-bottom z-50">
        {visibleNavItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex-1 py-3 flex flex-col items-center gap-0.5 text-xs font-medium transition-colors',
                isActive
                  ? 'text-primary bg-accent/50'
                  : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

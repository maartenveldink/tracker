import { NavLink, Outlet } from 'react-router-dom';
import { Dumbbell, ClipboardList, Play, TrendingUp, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/exercises', label: 'Oefeningen', icon: Dumbbell },
  { to: '/schemas', label: "Schema's", icon: ClipboardList },
  { to: '/start', label: 'Train', icon: Play },
  { to: '/progress', label: 'Progressie', icon: TrendingUp },
  { to: '/settings', label: 'Instellingen', icon: Settings },
];

export function Layout() {
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

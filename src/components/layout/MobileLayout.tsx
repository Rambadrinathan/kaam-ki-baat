import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, User, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  showNav?: boolean;
  showBackButton?: boolean;
}

export default function MobileLayout({ children, title, showNav = true, showBackButton = false }: MobileLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Navigation items with translated labels
  const navItems = [
    { href: '/', icon: Home, label: t.groups },
    { href: '/profile', icon: User, label: t.profile },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {(title || showBackButton) && (
        <header className="sticky top-0 z-40 bg-background border-b border-border px-4 py-4 flex items-center gap-3">
          {showBackButton && (
            <Button variant="ghost" size="icon" className="h-12 w-12" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-7 w-7" />
            </Button>
          )}
          {title && <h1 className="text-2xl font-bold text-foreground">{title}</h1>}
        </header>
      )}
      
      <main className="flex-1 overflow-y-auto pb-28">
        {children}
      </main>
      
      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
          <div className="flex items-center justify-around h-24">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center h-full px-6 min-w-[80px]",
                    "transition-colors",
                    isActive 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className="h-9 w-9" />
                  <span className="text-lg mt-1.5 font-bold">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

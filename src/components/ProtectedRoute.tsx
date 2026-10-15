import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (status === 'anonymous') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

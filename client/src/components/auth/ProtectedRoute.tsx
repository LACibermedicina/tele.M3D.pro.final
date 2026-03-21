import { ReactNode, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useLocation } from "wouter";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: Array<'doctor' | 'admin' | 'patient' | 'pharmacist' | 'researcher' | 'visitor'>;
  fallback?: ReactNode;
  skipModeCheck?: boolean;
}

export default function ProtectedRoute({ 
  children, 
  requiredRoles = [], 
  fallback,
  skipModeCheck = false 
}: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { hasChosenMode } = useViewMode();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !hasChosenMode && !skipModeCheck && location !== "/mode-selection") {
      setLocation("/mode-selection");
    }
  }, [isLoading, isAuthenticated, hasChosenMode, skipModeCheck, location, setLocation]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full mx-auto" />
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!hasChosenMode && !skipModeCheck && location !== "/mode-selection") {
    return null;
  }

  // Check role permissions if specified
  if (requiredRoles.length > 0 && user && !requiredRoles.includes(user.role)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md p-6">
          <div className="text-6xl">🚫</div>
          <h2 className="text-2xl font-bold text-foreground">Acesso Negado</h2>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
          <p className="text-sm text-muted-foreground">
            Tipo de usuário atual: <strong>{user.role}</strong>
            <br />
            Permissões necessárias: <strong>{requiredRoles.join(', ')}</strong>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
import { useCanAccess, useCreditGate } from '@/hooks/use-access-control';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldX, CreditCard, Lock, Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';

interface AccessGateProps {
  controlKey: string;
  children: React.ReactNode;
  checkCredits?: boolean;
}

export default function AccessGate({ controlKey, children, checkCredits = true }: AccessGateProps) {
  const { user } = useAuth();
  const { allowed: pageAllowed, loading: pageLoading } = useCanAccess(controlKey);
  const { allowed: creditAllowed, minimum, current, message, loading: creditLoading } = useCreditGate();
  const [, setLocation] = useLocation();

  if (!user) return <>{children}</>;

  if (user.username === 'root' || user.role === 'admin') return <>{children}</>;

  if (pageLoading || creditLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pageAllowed) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
              <ShieldX className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-xl">Acesso Restrito</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Esta funcionalidade foi temporariamente desativada pelo administrador do sistema.
            </p>
            <Button variant="outline" onClick={() => setLocation('/')}>
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (checkCredits && !creditAllowed) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-md w-full border-amber-300 dark:border-amber-700">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
              <CreditCard className="h-8 w-8 text-amber-600" />
            </div>
            <CardTitle className="text-xl">Créditos Insuficientes</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">{message}</p>
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Seus créditos:</span>
                <span className="font-bold text-red-600">{current} TMC</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Mínimo necessário:</span>
                <span className="font-bold text-amber-600">{minimum} TMC</span>
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setLocation('/')}>
                Voltar
              </Button>
              <Button onClick={() => setLocation('/wallet')} className="gap-2">
                <CreditCard className="h-4 w-4" />
                Recarregar Créditos
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

interface RegistrationGateProps {
  children: React.ReactNode;
}

export function RegistrationGate({ children }: RegistrationGateProps) {
  const { data, isLoading: loading } = useQuery<{ enabled: boolean }>({
    queryKey: ['/api/access-controls/public/registration'],
    staleTime: 30000,
  });
  const allowed = data?.enabled !== false;
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Lock className="h-8 w-8 text-slate-600" />
            </div>
            <CardTitle className="text-xl">Cadastro Temporariamente Suspenso</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              O cadastro de novos usuários está temporariamente desativado pelo administrador.
              Por favor, tente novamente mais tarde.
            </p>
            <Button variant="outline" onClick={() => setLocation('/')}>
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

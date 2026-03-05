import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

interface CreditGate {
  allowed: boolean;
  minimum: number;
  current: number;
  message: string;
}

interface AccessControlsResponse {
  controls: Record<string, boolean>;
  isRoot: boolean;
  creditGate: CreditGate;
}

export function useAccessControls() {
  const { user } = useAuth();
  return useQuery<AccessControlsResponse>({
    queryKey: ['/api/access-controls/check'],
    enabled: !!user,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export function useCanAccess(controlKey: string): { allowed: boolean; loading: boolean } {
  const { data, isLoading } = useAccessControls();
  const { user } = useAuth();

  if (!user) return { allowed: false, loading: false };
  if (user.username === 'root') return { allowed: true, loading: false };
  if (user.role === 'admin') return { allowed: true, loading: isLoading };
  if (isLoading || !data) return { allowed: true, loading: true };

  const controlValue = data.controls[controlKey];
  return { allowed: controlValue !== false, loading: false };
}

export function useCreditGate(): { allowed: boolean; minimum: number; current: number; message: string; loading: boolean } {
  const { data, isLoading } = useAccessControls();
  const { user } = useAuth();

  if (!user) return { allowed: false, minimum: 0, current: 0, message: '', loading: false };
  if (user.username === 'root' || user.role === 'admin') {
    return { allowed: true, minimum: 0, current: user.tmcCredits || 0, message: '', loading: false };
  }
  if (isLoading || !data) return { allowed: true, minimum: 0, current: 0, message: '', loading: true };

  return {
    allowed: data.creditGate.allowed,
    minimum: data.creditGate.minimum,
    current: data.creditGate.current,
    message: data.creditGate.message,
    loading: false,
  };
}

export function useIsRoot(): boolean {
  const { user } = useAuth();
  return user?.username === 'root';
}

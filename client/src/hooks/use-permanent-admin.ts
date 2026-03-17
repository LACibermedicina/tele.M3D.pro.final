import { useAuth } from "@/contexts/AuthContext";

export function useIsPermanentAdmin(): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return user.username === 'root' || (user as any).isProtected === true;
}

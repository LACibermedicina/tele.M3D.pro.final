import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

export type AccessModality = "classic" | "professional" | "assisted";

interface AuthMeResponse {
  effectiveAccessModality?: AccessModality;
  accessModality?: AccessModality | null;
}

const STORAGE_KEY = "tele_m3d_access_modality";
const DEFAULT_MODALITY: AccessModality = "professional";

interface AccessModalityContextType {
  modality: AccessModality;
  isClassic: boolean;
  isProfessional: boolean;
  isAssisted: boolean;
  setModality: (m: AccessModality, opts?: { persistRemote?: boolean }) => Promise<void>;
  globalDefault: AccessModality;
  setGlobalDefault: (m: AccessModality) => Promise<void>;
  isLoading: boolean;
}

function readStored(): AccessModality | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "classic" || v === "professional" || v === "assisted") return v;
  } catch {}
  return null;
}

const AccessModalityContext = createContext<AccessModalityContextType>({
  modality: DEFAULT_MODALITY,
  isClassic: false,
  isProfessional: true,
  isAssisted: false,
  setModality: async () => {},
  globalDefault: DEFAULT_MODALITY,
  setGlobalDefault: async () => {},
  isLoading: false,
});

export function AccessModalityProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [modality, setModalityState] = useState<AccessModality>(() => readStored() ?? DEFAULT_MODALITY);

  const { data: defaultData } = useQuery<{ value: AccessModality }>({
    queryKey: ["/api/system/access-modality-default"],
  });
  const globalDefault: AccessModality = (defaultData?.value as AccessModality) || DEFAULT_MODALITY;

  // Authoritative server-side modality for the authenticated user
  const { data: meData } = useQuery<AuthMeResponse>({
    queryKey: ["/api/auth/me"],
    enabled: isAuthenticated,
  });

  // Hydrate from server when user logs in (effective modality from /api/auth/me)
  useEffect(() => {
    if (isAuthenticated) {
      const eff = meData?.effectiveAccessModality;
      if (eff === "classic" || eff === "professional" || eff === "assisted") {
        setModalityState(eff);
        try { localStorage.setItem(STORAGE_KEY, eff); } catch {}
      }
    } else {
      // Visitors always render in Professional regardless of stored/global default.
      setModalityState(DEFAULT_MODALITY);
    }
  }, [meData, isAuthenticated]);

  // Reflect modality on documentElement for CSS-driven styling
  useEffect(() => {
    try {
      document.documentElement.setAttribute("data-access-modality", modality);
    } catch {}
  }, [modality]);

  const setModality = useCallback(async (m: AccessModality, opts?: { persistRemote?: boolean }) => {
    setModalityState(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch {}
    if (isAuthenticated && opts?.persistRemote !== false) {
      try {
        await apiRequest("PATCH", "/api/auth/access-modality", { accessModality: m });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      } catch (e) {
        console.warn("Failed to persist access modality remotely:", e);
      }
    }
  }, [isAuthenticated, queryClient]);

  const setGlobalDefault = useCallback(async (m: AccessModality) => {
    await apiRequest("PUT", "/api/admin/access-modality-default", { value: m });
    queryClient.invalidateQueries({ queryKey: ["/api/system/access-modality-default"] });
  }, [queryClient]);

  return (
    <AccessModalityContext.Provider
      value={{
        modality,
        isClassic: modality === "classic",
        isProfessional: modality === "professional",
        isAssisted: modality === "assisted",
        setModality,
        globalDefault,
        setGlobalDefault,
        isLoading: false,
      }}
    >
      {children}
    </AccessModalityContext.Provider>
  );
}

export function useAccessModality() {
  return useContext(AccessModalityContext);
}

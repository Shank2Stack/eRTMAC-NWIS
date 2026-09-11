import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import * as wellsApi from '../api/wellsApi';
import type { WellSummary } from '../types/api';
import { useAuth } from './AuthContext';

export interface ExtendedWellSummary extends WellSummary {
  id: string; // Alias for well_id to support existing component expectations
  name: string; // Alias for well_id
  field: string;
}

interface WellContextValue {
  activeWell: ExtendedWellSummary | null;
  activeWellId: string | null;
  setActiveWellId: (id: string) => void;
  allWells: ExtendedWellSummary[];
  loading: boolean;
  error: string | null;
  refreshWells: () => Promise<void>;
}

const WellContext = createContext<WellContextValue>({
  activeWell: null,
  activeWellId: null,
  setActiveWellId: () => {},
  allWells: [],
  loading: true,
  error: null,
  refreshWells: async () => {},
});

function toExtendedWell(w: WellSummary): ExtendedWellSummary {
  return {
    ...w,
    id: w.well_id,
    name: w.well_id,
    field: 'Volve Field (North Sea)',
  };
}

export function WellProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [allWells, setAllWells] = useState<ExtendedWellSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWells = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await wellsApi.getWells();
      const extended = data.map(toExtendedWell);
      setAllWells(extended);
      if (extended.length > 0) {
        setActiveId((prev) => {
          if (prev && extended.some((w) => w.well_id === prev)) {
            return prev;
          }
          return extended[0].well_id;
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load wells from backend.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchWells();
  }, [fetchWells]);

  const activeWell = allWells.find((w) => w.well_id === activeId) ?? allWells[0] ?? null;

  return (
    <WellContext.Provider
      value={{
        activeWell,
        activeWellId: activeId,
        setActiveWellId: setActiveId,
        allWells,
        loading,
        error,
        refreshWells: fetchWells,
      }}
    >
      {children}
    </WellContext.Provider>
  );
}

export function useWell() {
  return useContext(WellContext);
}

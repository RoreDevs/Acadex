import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { academicPeriodService } from '@/services/academicPeriodService';
import type { AcademicYear, Semester } from '@/types';

interface AcademicPeriodContextType {
  currentYear: AcademicYear | null;
  currentSemester: Semester | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AcademicPeriodContext = createContext<AcademicPeriodContextType | undefined>(undefined);

export function AcademicPeriodProvider({ children }: { children: ReactNode }) {
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);
  const [currentSemester, setCurrentSemester] = useState<Semester | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const period = await academicPeriodService.getCurrentPeriod();
    setCurrentYear(period.year);
    setCurrentSemester(period.semester);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AcademicPeriodContext.Provider value={{ currentYear, currentSemester, loading, refresh }}>
      {children}
    </AcademicPeriodContext.Provider>
  );
}

export function useCurrentAcademicPeriod() {
  const context = useContext(AcademicPeriodContext);
  if (!context) {
    throw new Error('useCurrentAcademicPeriod must be used within an AcademicPeriodProvider');
  }
  return context;
}

import { useState, useEffect } from 'react';
import { programService } from '@/services/programService';

export function useProgramName(programId: string | undefined): string {
  const [name, setName] = useState(programId || '');

  useEffect(() => {
    if (!programId) return;
    programService.getPrograms().then((programs) => {
      const p = programs.find((p: any) => p.id === programId);
      if (p) setName(p.name);
    });
  }, [programId]);

  return name;
}

export function useProgramsMap() {
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    programService.getPrograms().then((programs) => {
      const m: Record<string, string> = {};
      for (const p of programs) {
        m[p.id] = p.name;
      }
      setMap(m);
    });
  }, []);

  return map;
}

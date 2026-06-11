import { useState, useEffect } from 'react';
import { programService } from '@/services/programService';

const cache = new Map<string, string>();
let fetched = false;

export function useProgramName(programId: string | undefined): string {
  const [name, setName] = useState(() => cache.get(programId || '') || programId || '');

  useEffect(() => {
    if (!programId) return;
    if (cache.has(programId)) {
      setName(cache.get(programId)!);
      return;
    }
    programService.getPrograms().then((programs) => {
      for (const p of programs) {
        cache.set(p.id, p.name);
      }
      fetched = true;
      setName(cache.get(programId) || programId);
    });
  }, [programId]);

  return name;
}

export function useProgramsMap() {
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (fetched && Object.keys(map).length > 0) return;
    programService.getPrograms().then((programs) => {
      const m: Record<string, string> = {};
      for (const p of programs) {
        m[p.id] = p.name;
        cache.set(p.id, p.name);
      }
      fetched = true;
      setMap(m);
    });
  }, []);

  return map;
}

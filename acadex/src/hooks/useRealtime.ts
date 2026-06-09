import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export function useRealtimeSubscription<T>(
  table: string,
  filter?: string
) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      let query = supabase.from(table).select('*');
      if (filter) {
        query = query.or(filter);
      }
      const { data: result } = await query.order('created_at', { ascending: false });
      setData((result || []) as T[]);
      setIsLoading(false);
    };

    fetchData();

    const subscription = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload: RealtimePostgresChangesPayload<any>) => {
          if (payload.eventType === 'INSERT') {
            setData((prev) => [payload.new as T, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setData((prev) =>
              prev.map((item: any) =>
                item.id === payload.new.id ? (payload.new as T) : item
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setData((prev) =>
              prev.filter((item: any) => item.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [table, filter]);

  return { data, isLoading, setData };
}

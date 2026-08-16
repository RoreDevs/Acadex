import { Badge } from '@/components/ui/badge';

const STATUS_META: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' | 'outline' }> = {
  present: { label: 'Present', variant: 'success' },
  late: { label: 'Late', variant: 'warning' },
  absent: { label: 'Absent', variant: 'danger' },
  excused: { label: 'Excused', variant: 'default' },
  not_marked: { label: 'Not marked', variant: 'outline' },
  cancelled: { label: 'Cancelled', variant: 'outline' },
};

export function AttendanceStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status || 'Present', variant: 'outline' as const };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

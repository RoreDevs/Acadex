import { Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface FilterOption {
  id: string;
  label: string;
}

interface AnalyticsFiltersProps {
  semesters: FilterOption[];
  semesterValue: string;
  onSemesterChange: (value: string) => void;
  courses?: FilterOption[];
  courseValue?: string;
  onCourseChange?: (value: string) => void;
  showDateRange?: boolean;
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (value: string) => void;
  onEndDateChange?: (value: string) => void;
  className?: string;
}

export function AnalyticsFilters({
  semesters,
  semesterValue,
  onSemesterChange,
  courses,
  courseValue,
  onCourseChange,
  showDateRange = false,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  className,
}: AnalyticsFiltersProps) {
  return (
    <div className={cn('flex flex-col gap-3 lg:flex-row lg:items-end', className)}>
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 pb-1.5">
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Filters</span>
      </div>

      <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500">Semester</Label>
          <Select value={semesterValue || undefined} onValueChange={onSemesterChange}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="All semesters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All semesters</SelectItem>
              {semesters.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {courses && onCourseChange && (
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Course</Label>
            <Select value={courseValue || undefined} onValueChange={onCourseChange}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="All courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All courses</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showDateRange && onStartDateChange && (
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">From date</Label>
            <Input type="date" className="h-10" value={startDate || ''} onChange={(e) => onStartDateChange(e.target.value)} />
          </div>
        )}

        {showDateRange && onEndDateChange && (
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">To date</Label>
            <Input type="date" className="h-10" value={endDate || ''} onChange={(e) => onEndDateChange(e.target.value)} />
          </div>
        )}
      </div>
    </div>
  );
}

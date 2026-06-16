import { Calendar, User, Clock, FileText, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { assignmentService } from '@/services/assignmentService';

interface AssignmentDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: any | null;
}

export function AssignmentDetailModal({
  open,
  onOpenChange,
  assignment,
}: AssignmentDetailModalProps) {
  if (!assignment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-2xl">{assignment.title}</DialogTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline">{assignment.courses?.code}</Badge>
                {assignment.courses?.title && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">{assignment.courses.title}</span>
                )}
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-orange-500" />
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Description */}
          {assignment.description && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Description</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{assignment.description}</p>
            </div>
          )}

          {/* Attachment */}
          {assignment.file_url && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Attachment</h3>
              <a href={assignment.file_url} target="_blank" rel="noopener noreferrer" download>
                <Button variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  {assignment.file_name || 'Download File'}
                  {assignment.file_size && (
                    <span className="text-xs text-gray-400">({assignmentService.formatFileSize(assignment.file_size)})</span>
                  )}
                </Button>
              </a>
            </div>
          )}

          {/* Key Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {assignment.due_date && (
              <div className="flex gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                <Calendar className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Due Date</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {assignmentService.formatDueDate(assignment.due_date)}
                  </p>
                </div>
              </div>
            )}

            {assignment.profiles?.full_name && (
              <div className="flex gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                <User className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Instructor</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{assignment.profiles.full_name}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30">
              <Clock className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Posted</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {new Date(assignment.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Calendar, User, Clock, FileText } from 'lucide-react';
import { assignmentService } from '@/services/assignmentService';

interface Assignment {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  created_at: string;
  courses?: {
    code: string;
    title: string;
  };
  profiles?: {
    full_name: string;
  };
}

interface AssignmentDetailModalProps {
  assignment: Assignment | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AssignmentDetailModal({
  assignment,
  isOpen,
  onClose,
}: AssignmentDetailModalProps) {
  if (!assignment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <DialogTitle className="text-xl">{assignment.title}</DialogTitle>
              {assignment.courses && (
                <DialogDescription className="text-sm mt-1">
                  {assignment.courses.code} • {assignment.courses.title}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Description */}
          {assignment.description && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Description
              </h3>
              <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {assignment.description}
              </p>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Due Date */}
            {assignment.due_date && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">Due Date</span>
                </div>
                <p className="text-gray-900 dark:text-gray-100 font-semibold">
                  {assignmentService.formatDueDate(assignment.due_date)}
                </p>
              </div>
            )}

            {/* Instructor */}
            {assignment.profiles?.full_name && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium">Instructor</span>
                </div>
                <p className="text-gray-900 dark:text-gray-100 font-semibold">
                  {assignment.profiles.full_name}
                </p>
              </div>
            )}

            {/* Posted Date */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Posted</span>
              </div>
              <p className="text-gray-900 dark:text-gray-100 font-semibold">
                {new Date(assignment.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

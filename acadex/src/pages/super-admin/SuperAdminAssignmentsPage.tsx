import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, BookOpen, FileText, Clock, User, Search, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { assignmentService } from '@/services/assignmentService';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import toast from 'react-hot-toast';

export function SuperAdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingAssignmentId, setDeletingAssignmentId] = useState<string | null>(null);

  const loadAssignments = () => {
    setLoading(true);
    assignmentService.getAllAssignments()
      .then(setAssignments)
      .catch(() => toast.error('Failed to load assignments'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAssignments(); }, []);

  const handleDelete = async () => {
    if (!deletingAssignmentId) return;
    const { error } = await assignmentService.deleteAssignment(deletingAssignmentId);
    if (error) { toast.error(error.message); return; }
    toast.success('Assignment deleted');
    setAssignments((prev) => prev.filter((a) => a.id !== deletingAssignmentId));
    setDeleteOpen(false);
    setDeletingAssignmentId(null);
  };

  const filtered = assignments.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.description?.toLowerCase().includes(search.toLowerCase()) ||
    (a.courses?.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.courses?.code || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">All Assignments</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{assignments.length} assignment{assignments.length !== 1 ? 's' : ''} across all programs</p>
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assignments..."
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-gray-500">
            <BookOpen className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
            <p>{search ? 'No assignments match your search' : 'No assignments posted yet'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((assignment, i) => (
            <motion.div
              key={assignment.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-5 h-5 text-orange-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-primary-600 dark:text-primary-400 text-sm">
                      {assignment.courses?.code}
                    </p>
                    <span className="text-gray-500">•</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{assignment.courses?.title}</p>
                  </div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{assignment.title}</p>
                  {assignment.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{assignment.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
                    {assignment.due_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {assignmentService.formatDueDate(assignment.due_date)}
                      </div>
                    )}
                    {assignment.profiles?.full_name && (
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {assignment.profiles.full_name}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(assignment.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline" size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => { setDeletingAssignmentId(assignment.id); setDeleteOpen(true); }}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Delete
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Assignment"
        description="Are you sure you want to delete this assignment? This action cannot be undone."
        onConfirm={handleDelete}
        confirmText="Delete"
      />
    </motion.div>
  );
}

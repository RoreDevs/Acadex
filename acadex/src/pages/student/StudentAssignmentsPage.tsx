import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, FileText, Calendar, User, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { assignmentService } from '@/services/assignmentService';
import { AssignmentDetailModal } from '@/components/AssignmentDetailModal';
import toast from 'react-hot-toast';

export function StudentAssignmentsPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    assignmentService.getAssignmentsForStudent(user.id)
      .then(setAssignments)
      .catch((error) => {
        console.error('Failed to load assignments:', error);
        toast.error('Failed to load assignments');
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleAssignmentClick = (assignment: any) => {
    setSelectedAssignment(assignment);
    setIsModalOpen(true);
  };

  const grouped = assignments.reduce<Record<string, any[]>>((acc, assignment) => {
    const key = assignment.courses?.code || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(assignment);
    return acc;
  }, {});

  const newestAssignment = assignments.length > 0 ? assignments[0] : null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Assignments</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{assignments.length} assignment{assignments.length !== 1 ? 's' : ''} available</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-gray-500">
            <BookOpen className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
            <p>No assignments available for your courses yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
           {/* Newest Assignment Highlight */}
           {newestAssignment && (
             <motion.div
               initial={{ opacity: 0, y: 8 }}
               animate={{ opacity: 1, y: 0 }}
               onClick={() => handleAssignmentClick(newestAssignment)}
               className="rounded-xl border-2 border-primary-500/30 bg-gradient-to-br from-primary-50 to-primary-50/50 dark:from-primary-900/20 dark:to-primary-900/5 p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-primary-600 hover:bg-primary-700">Latest</Badge>
                    <p className="text-xs text-gray-500">{newestAssignment.courses?.code}</p>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{newestAssignment.title}</h3>
                  {newestAssignment.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{newestAssignment.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {newestAssignment.due_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Due: {assignmentService.formatDueDate(newestAssignment.due_date)}
                      </div>
                    )}
                    {newestAssignment.profiles?.full_name && (
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {newestAssignment.profiles.full_name}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {new Date(newestAssignment.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* All Assignments by Course */}
          <div className="space-y-6">
            {Object.entries(grouped).map(([courseCode, courseAssignments]) => (
              <div key={courseCode}>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary-500" />
                  {courseCode} - {courseAssignments[0]?.courses?.title}
                  <Badge variant="outline" className="ml-2 text-xs">{courseAssignments.length}</Badge>
                </h2>
                <div className="space-y-2">
                   {courseAssignments.filter(a => !newestAssignment || a.id !== newestAssignment.id).map((assignment, i) => (
                     <motion.div
                       key={assignment.id}
                       initial={{ opacity: 0, y: 8 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ delay: i * 0.03 }}
                       onClick={() => handleAssignmentClick(assignment)}
                       className="flex items-start gap-3 p-4 rounded-xl border bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:shadow-sm transition-shadow cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="w-5 h-5 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
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
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
       )}
       <AssignmentDetailModal
         open={isModalOpen}
         onOpenChange={setIsModalOpen}
         assignment={selectedAssignment}
       />
     </motion.div>
   );
 }

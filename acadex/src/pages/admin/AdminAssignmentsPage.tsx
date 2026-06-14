import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Trash2, BookOpen, Edit2, Calendar, FileText,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { courseService } from '@/services/courseService';
import { assignmentService } from '@/services/assignmentService';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import toast from 'react-hot-toast';

export function AdminAssignmentsPage() {
  const { profile } = useAuth();
  const programId = profile?.program;
  const [courses, setCourses] = useState<any[]>([]);
  const [assignmentsByCourse, setAssignmentsByCourse] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  const [postOpen, setPostOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentDescription, setAssignmentDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [posting, setPosting] = useState(false);

  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [updating, setUpdating] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingAssignmentId, setDeletingAssignmentId] = useState<string | null>(null);

  const loadData = async () => {
    if (!profile || !programId) return;
    setLoading(true);
    try {
      const coursesData = await courseService.getCoursesByProgram(programId, profile.level!);
      setCourses(coursesData);
      const assignmentsMap: Record<string, any[]> = {};
      for (const course of coursesData) {
        const assignments = await assignmentService.getAssignmentsByCourse(course.id, programId);
        assignmentsMap[course.id] = assignments;
      }
      setAssignmentsByCourse(assignmentsMap);
    } catch {
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  const loadAssignmentsForCourse = async (courseId: string) => {
    const assignments = await assignmentService.getAssignmentsByCourse(courseId, programId);
    setAssignmentsByCourse((prev) => ({ ...prev, [courseId]: assignments }));
  };

  useEffect(() => { loadData(); }, [profile]);

  const handlePost = async () => {
    if (!selectedCourseId || !assignmentTitle || !profile || !programId) {
      toast.error('Please fill required fields');
      return;
    }
    setPosting(true);
    const { error } = await assignmentService.createAssignment({
      title: assignmentTitle,
      description: assignmentDescription,
      due_date: dueDate || undefined,
      course_id: selectedCourseId,
      program_id: programId,
      posted_by: profile.id,
    });
    setPosting(false);
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    toast.success('Assignment posted');
    setPostOpen(false);
    setSelectedCourseId('');
    setAssignmentTitle('');
    setAssignmentDescription('');
    setDueDate('');
    await loadAssignmentsForCourse(selectedCourseId);
  };

  const handleEdit = (assignment: any) => {
    setEditingAssignmentId(assignment.id);
    setEditTitle(assignment.title);
    setEditDescription(assignment.description || '');
    setEditDueDate(assignment.due_date || '');
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingAssignmentId || !editTitle) {
      toast.error('Please fill required fields');
      return;
    }
    setUpdating(true);
    const { error } = await assignmentService.updateAssignment(editingAssignmentId, {
      title: editTitle,
      description: editDescription,
      due_date: editDueDate || undefined,
    });
    setUpdating(false);
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    toast.success('Assignment updated');
    setEditOpen(false);
    setEditingAssignmentId(null);
    setEditTitle('');
    setEditDescription('');
    setEditDueDate('');
    for (const cId of Object.keys(assignmentsByCourse)) {
      await loadAssignmentsForCourse(cId);
    }
  };

  const handleDelete = async () => {
    if (!deletingAssignmentId) return;
    const { error } = await assignmentService.deleteAssignment(deletingAssignmentId);
    if (error) { toast.error(error.message); return; }
    toast.success('Assignment deleted');
    setDeleteOpen(false);
    setDeletingAssignmentId(null);
    for (const cId of Object.keys(assignmentsByCourse)) {
      if (assignmentsByCourse[cId].some((a) => a.id === deletingAssignmentId)) {
        await loadAssignmentsForCourse(cId);
        break;
      }
    }
  };

  const toggleCourse = (courseId: string) => {
    setExpandedCourse(expandedCourse === courseId ? null : courseId);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Assignments</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Post and manage assignments for your courses</p>
        </div>
        <Dialog open={postOpen} onOpenChange={setPostOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Post Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Post New Assignment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} - {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={assignmentTitle} onChange={(e) => setAssignmentTitle(e.target.value)} placeholder="e.g. Chapter 1 Exercise" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={assignmentDescription} onChange={(e) => setAssignmentDescription(e.target.value)} placeholder="Assignment details..." rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handlePost} disabled={posting}>
                {posting ? 'Posting...' : 'Post Assignment'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-gray-500">
            <BookOpen className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
            <p>No courses assigned to your program</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => {
            const assignments = assignmentsByCourse[course.id] || [];
            const isExpanded = expandedCourse === course.id;
            return (
              <Card key={course.id} className="overflow-hidden">
                <button
                  onClick={() => toggleCourse(course.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-primary-500 shrink-0" />
                    <div className="text-left">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{course.title}</p>
                      <p className="text-sm text-gray-500">{course.code} &middot; {assignments.length} assignment{assignments.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700">
                    {assignments.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">No assignments posted for this course</div>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {assignments.map((assignment, i) => (
                          <motion.div
                            key={assignment.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <FileText className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-gray-900 dark:text-gray-100">{assignment.title}</p>
                                  {assignment.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{assignment.description}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  variant="ghost" size="icon"
                                  className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  onClick={() => handleEdit(assignment)}
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon"
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  onClick={() => { setDeletingAssignmentId(assignment.id); setDeleteOpen(true); }}
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            {assignment.due_date && (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Calendar className="w-4 h-4" />
                                <span>Due: {assignmentService.formatDueDate(assignment.due_date)}</span>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Assignment title" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Assignment details..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="datetime-local" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
            </div>
            <Button className="w-full" onClick={handleUpdate} disabled={updating}>
              {updating ? 'Updating...' : 'Update Assignment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Assignment"
        description="Are you sure you want to delete this assignment?"
        onConfirm={handleDelete}
        confirmText="Delete"
      />
    </motion.div>
  );
}

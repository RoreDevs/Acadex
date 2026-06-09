import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { DataTable } from '@/components/shared/DataTable';
import { courseService } from '@/services/courseService';
import { programService } from '@/services/programService';
import { exportToCSV } from '@/utils/export';
import { useAuth } from '@/contexts/AuthContext';
import { auditService } from '@/services/auditService';
import toast from 'react-hot-toast';

const LEVELS = ['Level 100', 'Level 200', 'Level 300', 'Level 400'];

export function CourseManagementPage() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [program_id, setProgramId] = useState('');
  const [level, setLevel] = useState('');
  const [credits, setCredits] = useState('3');

  const loadData = async () => {
    try {
      const [c, p] = await Promise.all([courseService.getCourses(), programService.getPrograms()]);
      setCourses(c);
      setPrograms(p);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const resetForm = () => {
    setTitle(''); setCode(''); setProgramId(''); setLevel(''); setCredits('3'); setEditing(null);
  };

  const openEdit = (course: any) => {
    setEditing(course);
    setTitle(course.title);
    setCode(course.code);
    setProgramId(course.program_id);
    setLevel(course.level);
    setCredits(course.credits?.toString() || '3');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title || !code || !program_id || !level) { toast.error('Please fill all fields'); return; }
    if (editing) {
      const { error } = await courseService.updateCourse(editing.id, { title, code, program_id, level, credits: parseInt(credits) });
      if (error) toast.error(error.message);
      else {
        toast.success('Course updated');
        if (profile) await auditService.logAction(profile.id, profile.full_name, 'Update Course', `Updated ${editing.title}`);
      }
    } else {
      const { error } = await courseService.createCourse({ title, code, program_id, level, credits: parseInt(credits) });
      if (error) toast.error(error.message);
      else {
        toast.success('Course created');
        if (profile) await auditService.logAction(profile.id, profile.full_name, 'Create Course', `Created ${title}`);
      }
    }
    setDialogOpen(false);
    resetForm();
    loadData();
  };

  const handleDelete = async () => {
    if (!editing) return;
    const { error } = await courseService.deleteCourse(editing.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Course deleted');
      if (profile) await auditService.logAction(profile.id, profile.full_name, 'Delete Course', `Deleted ${editing.title}`);
    }
    setDeleteOpen(false);
    setEditing(null);
    loadData();
  };

  const columns = [
    { key: 'code', header: 'Code', render: (item: any) => <span className="font-mono font-medium">{item.code}</span> },
    { key: 'title', header: 'Title' },
    { key: 'programs', header: 'Program', render: (item: any) => item.programs?.name || 'N/A' },
    { key: 'level', header: 'Level' },
    { key: 'credits', header: 'Credits' },
    { key: 'actions', header: 'Actions', sortable: false, render: (item: any) => (
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(item); }}>
          <Edit className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" className="text-red-500" onClick={(e) => {
          e.stopPropagation();
          setEditing(item);
          setDeleteOpen(true);
        }}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    )},
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Course Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{courses.length} courses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (courses.length === 0) return;
            exportToCSV(courses.map((c) => ({
              Code: c.code, Title: c.title, Program: c.programs?.name, Level: c.level, Credits: c.credits
            })), 'courses');
            toast.success('CSV exported');
          }}>Export CSV</Button>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Add Course</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Course' : 'Add Course'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Course Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Programming Fundamentals" />
                </div>
                <div className="space-y-2">
                  <Label>Course Code</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., ICT101" />
                </div>
                <div className="space-y-2">
                  <Label>Program</Label>
                  <Select value={program_id} onValueChange={setProgramId}>
                    <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
                    <SelectContent>
                      {programs.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Credits</Label>
                  <Input type="number" value={credits} onChange={(e) => setCredits(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleSave}>
                  {editing ? 'Update' : 'Create'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <DataTable columns={columns} data={courses} searchPlaceholder="Search courses..." />
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Course"
        description={`Are you sure you want to delete ${editing?.title}?`}
        onConfirm={handleDelete}
      />
    </motion.div>
  );
}

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, BookOpen, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { DataTable } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { courseService } from '@/services/courseService';
import { programService } from '@/services/programService';
import { useAuth } from '@/contexts/AuthContext';
import { auditService } from '@/services/auditService';
import { friendlyErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';

const LEVELS = ['Level 100', 'Level 200', 'Level 300', 'Level 400'];
const SEMESTERS = [
  { value: '1', label: 'Semester 1' },
  { value: '2', label: 'Semester 2' },
];

export function CurriculumPage() {
  const { profile } = useAuth();
  const [programs, setPrograms] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [usage, setUsage] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [programId, setProgramId] = useState('');
  const [level, setLevel] = useState('');
  const [semester, setSemester] = useState('1');

  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<'existing' | 'new'>('existing');
  const [existingCourseId, setExistingCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [credits, setCredits] = useState('3');
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editCredits, setEditCredits] = useState('3');

  const [removeTarget, setRemoveTarget] = useState<any>(null);

  const ready = !!programId && !!level && !!semester;

  const loadBase = async () => {
    try {
      const [p, c] = await Promise.all([programService.getPrograms(), courseService.getCourses()]);
      setPrograms(p);
      setCatalog(c);
    } catch {
      toast.error('Failed to load programs and courses');
    }
  };

  const loadCurriculum = async () => {
    if (!ready) { setRows([]); setUsage([]); setLoading(false); return; }
    setLoading(true);
    try {
      const [r, u] = await Promise.all([
        courseService.getCurriculum(programId, level, Number(semester)),
        courseService.getCurriculumUsage(programId, level, Number(semester)),
      ]);
      setRows(r);
      setUsage(u);
    } catch {
      toast.error('Failed to load curriculum');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { loadCurriculum(); }, [programId, level, semester]);

  const programName = programs.find((p) => p.id === programId)?.name || '';
  const existingIds = new Set(rows.map((r) => r.course_id));
  const addable = catalog.filter((c) => !existingIds.has(c.id));

  const resetAdd = () => {
    setAddMode('existing'); setExistingCourseId('');
    setTitle(''); setCode(''); setCredits('3');
  };

  const handleAdd = async () => {
    if (!ready) return;
    setSaving(true);
    try {
      let courseId = existingCourseId;
      let courseLabel = '';
      if (addMode === 'new') {
        if (!title || !code) { toast.error('Please fill course title and code'); setSaving(false); return; }
        const { data, error } = await courseService.createCourse({
          title, code, program_id: programId, level, credits: parseInt(credits) || 3,
        });
        if (error || !data) {
          toast.error(friendlyErrorMessage(error, 'Failed to create course'));
          setSaving(false);
          return;
        }
        courseId = data.id;
        courseLabel = `${data.code} - ${data.title}`;
        setCatalog((prev) => [...prev, data]);
      } else {
        if (!courseId) { toast.error('Please select a course'); setSaving(false); return; }
        const picked = catalog.find((c) => c.id === courseId);
        courseLabel = picked ? `${picked.code} - ${picked.title}` : courseId;
      }
      const { error } = await courseService.addCourseToCurriculum({
        program_id: programId, level, semester_number: Number(semester), course_id: courseId,
      });
      if (error) {
        toast.error(friendlyErrorMessage(error, 'Failed to add course to curriculum'));
      } else {
        toast.success('Course added to curriculum');
        if (profile) await auditService.logAction(profile.id, profile.full_name, 'Curriculum Update', `Added ${courseLabel} to ${programName} ${level} Semester ${semester}`);
        setAddOpen(false);
        resetAdd();
        loadCurriculum();
      }
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row: any) => {
    setEditing(row);
    setEditTitle(row.courses?.title || '');
    setEditCode(row.courses?.code || '');
    setEditCredits(row.courses?.credits?.toString() || '3');
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editing || !editTitle || !editCode) { toast.error('Please fill all fields'); return; }
    const { error } = await courseService.updateCourse(editing.course_id, {
      title: editTitle, code: editCode, credits: parseInt(editCredits) || 3,
    });
    if (error) {
      toast.error(friendlyErrorMessage(error, 'Failed to update course'));
      return;
    }
    toast.success('Course updated');
    if (profile) await auditService.logAction(profile.id, profile.full_name, 'Curriculum Update', `Edited course ${editCode} - ${editTitle}`);
    setEditOpen(false);
    setEditing(null);
    const [c] = await Promise.all([courseService.getCourses()]);
    setCatalog(c);
    loadCurriculum();
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    const { error } = await courseService.removeCourseFromCurriculum(removeTarget.id);
    if (error) {
      toast.error(friendlyErrorMessage(error, 'Failed to remove course'));
    } else {
      const label = `${removeTarget.courses?.code} - ${removeTarget.courses?.title}`;
      toast.success('Course removed from curriculum');
      if (profile) await auditService.logAction(profile.id, profile.full_name, 'Curriculum Update', `Removed ${label} from ${programName} ${level} Semester ${semester}. Historical records are unchanged.`);
    }
    setRemoveTarget(null);
    loadCurriculum();
  };

  const columns = [
    { key: 'code', header: 'Code', render: (item: any) => <span className="font-mono font-medium">{item.courses?.code || 'N/A'}</span> },
    { key: 'title', header: 'Title', render: (item: any) => item.courses?.title || 'N/A' },
    { key: 'credits', header: 'Credits', render: (item: any) => item.courses?.credits ?? '—' },
    {
      key: 'actions', header: 'Actions', sortable: false, render: (item: any) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(item); }}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-red-500" onClick={(e) => { e.stopPropagation(); setRemoveTarget(item); }}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Curriculum Management</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Configure each program's reusable course structure once — future academic years reuse it automatically</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Program</Label>
              <Select value={programId} onValueChange={setProgramId}>
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
              <Label>Semester</Label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {ready && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5" />
                {programName} · {level} · Semester {semester}
              </CardTitle>
              <Button size="sm" onClick={() => { resetAdd(); setAddOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Add Course
              </Button>
            </div>
            {usage.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className="text-xs text-gray-400">Used in:</span>
                {usage.map((u) => (
                  <Badge key={u} variant="outline" className="text-xs">{u}</Badge>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <BookOpen className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
                <p>No courses configured for this curriculum yet.</p>
                <p className="text-sm text-gray-400 mt-1">Click Add Course to configure it once — future cohorts reuse it automatically.</p>
              </div>
            ) : (
              <DataTable columns={columns} data={rows} searchPlaceholder="Search curriculum courses..." />
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Course to Curriculum</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button variant={addMode === 'existing' ? 'default' : 'outline'} size="sm" onClick={() => setAddMode('existing')}>
                Select Existing
              </Button>
              <Button variant={addMode === 'new' ? 'default' : 'outline'} size="sm" onClick={() => setAddMode('new')}>
                Create New
              </Button>
            </div>
            {addMode === 'existing' ? (
              <div className="space-y-2">
                <Label>Course Catalog</Label>
                <Select value={existingCourseId} onValueChange={setExistingCourseId}>
                  <SelectTrigger><SelectValue placeholder="Choose a course" /></SelectTrigger>
                  <SelectContent>
                    {addable.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.code} — {c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {addable.length === 0 && (
                  <p className="text-xs text-gray-400">All catalog courses are already in this curriculum.</p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Course Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Database Systems" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Course Code</Label>
                    <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., ICT 201" />
                  </div>
                  <div className="space-y-2">
                    <Label>Credits</Label>
                    <Input type="number" min={0} value={credits} onChange={(e) => setCredits(e.target.value)} />
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? 'Saving...' : 'Add to Curriculum'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Course Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Course Code</Label>
                <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Credits</Label>
                <Input type="number" min={0} value={editCredits} onChange={(e) => setEditCredits(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={!!removeTarget}
        onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
        title="Remove Course from Curriculum"
        description={removeTarget
          ? `Remove ${removeTarget.courses?.code} - ${removeTarget.courses?.title} from ${programName} ${level} Semester ${semester}? Future academic contexts will no longer include it. The course record and all historical attendance, assignments and materials stay unchanged.`
          : ''}
        onConfirm={handleRemove}
        confirmText="Remove from Curriculum"
        confirmVariant="destructive"
      />
    </motion.div>
  );
}

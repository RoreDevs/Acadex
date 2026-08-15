import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Edit, Trash2, CalendarRange, Star, Archive, ChevronDown, ChevronUp, Layers,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { academicPeriodService } from '@/services/academicPeriodService';
import { useCurrentAcademicPeriod } from '@/contexts/AcademicPeriodContext';
import { auditService } from '@/services/auditService';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import type { AcademicYear, Semester } from '@/types';

export function AcademicPeriodsPage() {
  const { profile } = useAuth();
  const { currentYear, currentSemester, refresh } = useCurrentAcademicPeriod();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [offeringCounts, setOfferingCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});

  const [yearDialogOpen, setYearDialogOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [yearName, setYearName] = useState('');
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');

  const [semesterDialogOpen, setSemesterDialogOpen] = useState(false);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  const [semesterYearId, setSemesterYearId] = useState('');
  const [semesterName, setSemesterName] = useState('');
  const [semesterNumber, setSemesterNumber] = useState('1');
  const [semesterStart, setSemesterStart] = useState('');
  const [semesterEnd, setSemesterEnd] = useState('');

  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; description: string; action: () => Promise<void> } | null>(null);

  const loadData = async () => {
    try {
      const [yearList, counts] = await Promise.all([
        academicPeriodService.getYears(),
        academicPeriodService.getOfferingCounts(),
      ]);
      setYears(yearList);
      setOfferingCounts(counts);
    } catch {
      toast.error('Failed to load academic periods');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const resetYearForm = () => {
    setEditingYear(null);
    setYearName(''); setYearStart(''); setYearEnd('');
  };

  const openYearDialog = (year?: AcademicYear) => {
    if (year) {
      setEditingYear(year);
      setYearName(year.name);
      setYearStart(year.start_date);
      setYearEnd(year.end_date);
    } else {
      resetYearForm();
    }
    setYearDialogOpen(true);
  };

  const handleSaveYear = async () => {
    if (!yearName.trim() || !yearStart || !yearEnd) {
      toast.error('Please fill all fields');
      return;
    }
    if (yearEnd < yearStart) {
      toast.error('End date must be after the start date');
      return;
    }
    const payload = { name: yearName.trim(), start_date: yearStart, end_date: yearEnd };
    const { error } = editingYear
      ? await academicPeriodService.updateYear(editingYear.id, payload)
      : await academicPeriodService.createYear(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingYear ? 'Academic year updated' : 'Academic year created');
    if (profile) {
      await auditService.logAction(profile.id, profile.full_name, editingYear ? 'Update Academic Year' : 'Create Academic Year', payload.name);
    }
    setYearDialogOpen(false);
    resetYearForm();
    loadData();
  };

  const handleSetCurrentYear = async (year: AcademicYear) => {
    const { error } = await academicPeriodService.setCurrentYear(year.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${year.name} is now the current academic year`);
    if (profile) await auditService.logAction(profile.id, profile.full_name, 'Set Current Academic Year', year.name);
    await refresh();
    loadData();
  };

  const handleArchiveYear = async (year: AcademicYear) => {
    const { error } = await academicPeriodService.archiveYear(year.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${year.name} archived`);
    if (profile) await auditService.logAction(profile.id, profile.full_name, 'Archive Academic Year', year.name);
    await refresh();
    loadData();
  };

  const handleDeleteYear = async () => {
    if (!editingYear) return;
    const { error } = await academicPeriodService.deleteYear(editingYear.id);
    setConfirmState(null);
    if (error) {
      toast.error(error.message || 'Cannot delete this academic year. It may contain semesters or records.');
      return;
    }
    toast.success('Academic year deleted');
    if (profile) await auditService.logAction(profile.id, profile.full_name, 'Delete Academic Year', editingYear.name);
    setEditingYear(null);
    loadData();
  };

  const resetSemesterForm = () => {
    setEditingSemester(null);
    setSemesterName(''); setSemesterNumber('1'); setSemesterStart(''); setSemesterEnd('');
  };

  const openSemesterDialog = (year: AcademicYear, semester?: Semester) => {
    setSemesterYearId(year.id);
    if (semester) {
      setEditingSemester(semester);
      setSemesterName(semester.name);
      setSemesterNumber(String(semester.semester_number));
      setSemesterStart(semester.start_date);
      setSemesterEnd(semester.end_date);
    } else {
      resetSemesterForm();
      setSemesterStart(year.start_date);
      setSemesterEnd(year.end_date);
    }
    setSemesterDialogOpen(true);
  };

  const handleSaveSemester = async () => {
    if (!semesterName.trim() || !semesterNumber || !semesterStart || !semesterEnd) {
      toast.error('Please fill all fields');
      return;
    }
    const year = years.find((y) => y.id === semesterYearId);
    if (!year) { toast.error('Academic year not found'); return; }
    if (semesterEnd < semesterStart) {
      toast.error('End date must be after the start date');
      return;
    }
    if (semesterStart < year.start_date || semesterEnd > year.end_date) {
      toast.error(`Semester dates must fall within the academic year (${year.start_date} → ${year.end_date})`);
      return;
    }
    const payload = {
      academic_year_id: semesterYearId,
      name: semesterName.trim(),
      semester_number: parseInt(semesterNumber, 10),
      start_date: semesterStart,
      end_date: semesterEnd,
    };
    const { error } = editingSemester
      ? await academicPeriodService.updateSemester(editingSemester.id, payload)
      : await academicPeriodService.createSemester(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingSemester ? 'Semester updated' : 'Semester created');
    if (profile) {
      await auditService.logAction(profile.id, profile.full_name, editingSemester ? 'Update Semester' : 'Create Semester', payload.name);
    }
    setSemesterDialogOpen(false);
    resetSemesterForm();
    loadData();
  };

  const handleSetCurrentSemester = async (semester: Semester) => {
    const { error } = await academicPeriodService.setCurrentSemester(semester.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${semester.name} is now the current semester`);
    if (profile) await auditService.logAction(profile.id, profile.full_name, 'Set Current Semester', semester.name);
    await refresh();
    loadData();
  };

  const handleArchiveSemester = async (semester: Semester) => {
    const { error } = await academicPeriodService.archiveSemester(semester.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${semester.name} archived`);
    if (profile) await auditService.logAction(profile.id, profile.full_name, 'Archive Semester', semester.name);
    await refresh();
    loadData();
  };

  const handleDeleteSemester = async () => {
    if (!editingSemester) return;
    const { error } = await academicPeriodService.deleteSemester(editingSemester.id);
    setConfirmState(null);
    if (error) {
      toast.error(error.message || 'Cannot delete this semester. It may contain course offerings or records.');
      return;
    }
    toast.success('Semester deleted');
    if (profile) await auditService.logAction(profile.id, profile.full_name, 'Delete Semester', editingSemester.name);
    setEditingSemester(null);
    loadData();
  };

  const toggleYear = (id: string) => {
    setExpandedYears((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const sortedYears = [...years].sort((a, b) => (b.is_current ? 1 : 0) - (a.is_current ? 1 : 0) || (b.start_date > a.start_date ? 1 : -1));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Academic Periods</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage academic years and semesters. Historical records are always preserved.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {currentYear && currentSemester && (
            <Badge variant="success" className="px-3 py-1">
              <CalendarRange className="w-3.5 h-3.5 mr-1.5" />
              Current: {currentYear.name} · {currentSemester.name}
            </Badge>
          )}
          <Dialog open={yearDialogOpen} onOpenChange={(o) => { setYearDialogOpen(o); if (!o) resetYearForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={() => openYearDialog()}><Plus className="w-4 h-4 mr-2" />Add Academic Year</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingYear ? 'Edit Academic Year' : 'Add Academic Year'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="year-name">Name</Label>
                  <Input id="year-name" value={yearName} onChange={(e) => setYearName(e.target.value)} placeholder="e.g., 2026/2027" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="year-start">Start Date</Label>
                    <Input id="year-start" type="date" value={yearStart} onChange={(e) => setYearStart(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year-end">End Date</Label>
                    <Input id="year-end" type="date" value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} />
                  </div>
                </div>
                <Button className="w-full" onClick={handleSaveYear}>
                  {editingYear ? 'Update' : 'Create'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={semesterDialogOpen} onOpenChange={(o) => { setSemesterDialogOpen(o); if (!o) resetSemesterForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSemester ? 'Edit Semester' : 'Add Semester'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="semester-name">Name</Label>
              <Input id="semester-name" value={semesterName} onChange={(e) => setSemesterName(e.target.value)} placeholder="e.g., First Semester" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="semester-number">Semester Number</Label>
              <Input id="semester-number" type="number" min={1} max={6} value={semesterNumber} onChange={(e) => setSemesterNumber(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="semester-start">Start Date</Label>
                <Input id="semester-start" type="date" value={semesterStart} onChange={(e) => setSemesterStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="semester-end">End Date</Label>
                <Input id="semester-end" type="date" value={semesterEnd} onChange={(e) => setSemesterEnd(e.target.value)} />
              </div>
            </div>
            <Button className="w-full" onClick={handleSaveSemester}>
              {editingSemester ? 'Update' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sortedYears.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-gray-500">
            <CalendarRange className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
            <p>No academic years yet. Create one to start organizing your semesters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedYears.map((year) => {
            const semesters = year.semesters || [];
            const expanded = !!expandedYears[year.id];
            const hasOfferingSemesters = semesters.some((s) => (offeringCounts[s.id] || 0) > 0);
            return (
              <Card key={year.id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
                        <Layers className="w-5 h-5 text-primary-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{year.name}</h3>
                          {year.is_current && <Badge variant="success"><Star className="w-3 h-3 mr-1" />Current</Badge>}
                          {year.is_archived && <Badge variant="outline">Archived</Badge>}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {year.start_date} → {year.end_date} · {semesters.length} semester{semesters.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => toggleYear(year.id)}>
                        {expanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                        Semesters
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openYearDialog(year)}>
                        <Edit className="w-4 h-4 mr-1" />Edit
                      </Button>
                      {!year.is_current && (
                        <Button variant="outline" size="sm" onClick={() => handleSetCurrentYear(year)}>
                          <Star className="w-4 h-4 mr-1" />Set Current
                        </Button>
                      )}
                      {!year.is_archived && !year.is_current && (
                        <Button variant="outline" size="sm" onClick={() => handleArchiveYear(year)}>
                          <Archive className="w-4 h-4 mr-1" />Archive
                        </Button>
                      )}
                      {!hasOfferingSemesters && semesters.length === 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => {
                            setEditingYear(year);
                            setConfirmState({
                              open: true,
                              title: 'Delete Academic Year',
                              description: `Delete "${year.name}"? Only years without semesters or records can be deleted.`,
                              action: handleDeleteYear,
                            });
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />Delete
                        </Button>
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Semesters</p>
                        <Button variant="outline" size="sm" onClick={() => openSemesterDialog(year)}>
                          <Plus className="w-4 h-4 mr-1" />Add Semester
                        </Button>
                      </div>
                      {semesters.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 py-2">No semesters for this academic year.</p>
                      ) : (
                        semesters
                          .slice()
                          .sort((a, b) => a.semester_number - b.semester_number)
                          .map((sem) => (
                            <div key={sem.id} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    Semester {sem.semester_number} · {sem.name}
                                  </span>
                                  {sem.is_current && <Badge variant="success">Current</Badge>}
                                  {sem.is_archived && <Badge variant="outline">Archived</Badge>}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {sem.start_date} → {sem.end_date}
                                  {offeringCounts[sem.id] ? ` · ${offeringCounts[sem.id]} course offering${offeringCounts[sem.id] === 1 ? '' : 's'}` : ''}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Button variant="ghost" size="sm" onClick={() => openSemesterDialog(year, sem)}>
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                                {!sem.is_current && (
                                  <Button variant="ghost" size="sm" onClick={() => handleSetCurrentSemester(sem)}>
                                    <Star className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                {!sem.is_archived && !sem.is_current && (
                                  <Button variant="ghost" size="sm" onClick={() => handleArchiveSemester(sem)}>
                                    <Archive className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                {!offeringCounts[sem.id] && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-600"
                                    onClick={() => {
                                      setEditingSemester(sem);
                                      setConfirmState({
                                        open: true,
                                        title: 'Delete Semester',
                                        description: `Delete "${sem.name}"? Only semesters without course offerings or records can be deleted.`,
                                        action: handleDeleteSemester,
                                      });
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!confirmState}
        onOpenChange={(o) => { if (!o) setConfirmState(null); }}
        title={confirmState?.title || ''}
        description={confirmState?.description || ''}
        onConfirm={() => confirmState?.action()}
      />
    </motion.div>
  );
}

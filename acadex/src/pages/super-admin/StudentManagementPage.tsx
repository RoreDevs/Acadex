import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Trash2, Edit, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/DataTable';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { profileService } from '@/services/profileService';
import { exportToCSV, exportToExcel } from '@/utils/export';
import { useProgramsMap } from '@/hooks/useProgramName';
import toast from 'react-hot-toast';

export function StudentManagementPage() {
  const programsMap = useProgramsMap();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const loadStudents = () => {
    profileService.getAllStudents()
      .then(setStudents)
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStudents(); }, []);

  const handleDelete = async () => {
    if (!selectedStudent) return;
    const { error } = await profileService.deleteProfile(selectedStudent.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Student deleted');
      setDeleteOpen(false);
      setSelectedStudent(null);
      loadStudents();
    }
  };

  const columns = [
    { key: 'full_name', header: 'Full Name', render: (item: any) => (
      <span className="font-medium">{item.full_name}</span>
    )},
    { key: 'index_number', header: 'Index Number' },
    { key: 'email', header: 'Email' },
    { key: 'program', header: 'Program', render: (item: any) => programsMap[item.program] || item.program },
    { key: 'level', header: 'Level' },
    { key: 'actions', header: 'Actions', sortable: false, render: (item: any) => (
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); }}>
          <Edit className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost" size="sm"
          className="text-red-500 hover:text-red-600"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedStudent(item);
            setDeleteOpen(true);
          }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    )},
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Student Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{students.length} total students</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (students.length === 0) return;
            exportToCSV(students.map((s) => ({
              Name: s.full_name,
              'Index Number': s.index_number,
              Email: s.email,
              Program: programsMap[s.program] || s.program,
              Level: s.level,
            })), 'all-students');
            toast.success('CSV exported');
          }}>Export CSV</Button>
          <Button variant="outline" size="sm" onClick={() => {
            if (students.length === 0) return;
            exportToExcel(students.map((s) => ({
              Name: s.full_name,
              'Index Number': s.index_number,
              Email: s.email,
              Program: programsMap[s.program] || s.program,
              Level: s.level,
            })), 'all-students');
            toast.success('Excel exported');
          }}>Export Excel</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={students}
              searchPlaceholder="Search by name, index, or email..."
            />
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Student"
        description={`Are you sure you want to delete ${selectedStudent?.full_name}? This will remove all their data permanently.`}
        onConfirm={handleDelete}
        confirmText="Delete Student"
      />
    </motion.div>
  );
}

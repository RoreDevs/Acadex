import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, Search, ArrowRightLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { profileService } from '@/services/profileService';
import { useProgramName } from '@/hooks/useProgramName';
import { exportToCSV, exportToExcel, exportToPDF } from '@/utils/export';
import toast from 'react-hot-toast';

const INITIAL_CLASS_A: string[] = [
  "B202250058",
];

export function AdminStudentsPage() {
  const { profile } = useAuth();
  const programName = useProgramName(profile?.program);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'A' | 'B'>('A');
  const [customClassMap, setCustomClassMap] = useState<Record<string, 'A' | 'B'>>({});

  const isBtechCSLevel100 = profile?.program === 'BTECH-CS' && profile?.level === 'Level 100';

  useEffect(() => {
    if (!profile?.program || !profile?.level) return;
    profileService.getStudentsByProgram(profile.program, profile.level)
      .then(setStudents)
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoading(false));
  }, [profile?.program, profile?.level]);

  const { classA, classB } = useMemo(() => {
    if (!isBtechCSLevel100) return { classA: students, classB: [] as any[] };
    const a: any[] = [];
    const b: any[] = [];
    for (const s of students) {
      const override = customClassMap[s.index_number];
      if (override) {
        (override === 'A' ? a : b).push(s);
      } else if (INITIAL_CLASS_A.includes(s.index_number)) {
        a.push(s);
      } else {
        b.push(s);
      }
    }
    return { classA: a, classB: b };
  }, [students, customClassMap, isBtechCSLevel100]);

  const moveStudent = (index: string, to: 'A' | 'B') => {
    setCustomClassMap((prev) => ({ ...prev, [index]: to }));
  };

  const currentList = isBtechCSLevel100 ? (activeTab === 'A' ? classA : classB) : students;

  const filtered = currentList.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.index_number?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    );
  });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Students</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {programName} - {profile?.level}
            {isBtechCSLevel100 ? ` • Class ${activeTab} (${currentList.length} students)` : ` • ${students.length} students`}
          </p>
        </div>
        {students.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              exportToCSV(students.map((s) => ({
                Name: s.full_name,
                'Index Number': s.index_number,
              })), `${programName.replace(/\s+/g, '-').toLowerCase()}-students`);
              toast.success('CSV exported');
            }}>CSV</Button>
            <Button variant="outline" size="sm" onClick={() => {
              exportToExcel(students.map((s) => ({
                Name: s.full_name,
                'Index Number': s.index_number,
              })), `${programName.replace(/\s+/g, '-').toLowerCase()}-students`);
              toast.success('Excel exported');
            }}>Excel</Button>
            <Button variant="outline" size="sm" onClick={() => {
              exportToPDF(
                students.map((s) => ({
                  'Full Name': s.full_name,
                  'Index Number': s.index_number,
                })),
                `${programName.replace(/\s+/g, '-').toLowerCase()}-students`,
                `${programName} - Level ${profile?.level} Students`,
                ['Full Name', 'Index Number']
              );
              toast.success('PDF exported');
            }}>PDF</Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-6">
          {isBtechCSLevel100 && (
            <div className="flex gap-2 mb-4">
              <Button
                variant={activeTab === 'A' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('A')}
              >
                Class A ({classA.length})
              </Button>
              <Button
                variant={activeTab === 'B' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('B')}
              >
                Class B ({classB.length})
              </Button>
            </div>
          )}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name, index, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Users className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
              <p>{search ? 'No students match your search.' : isBtechCSLevel100 ? `No students in Class ${activeTab}.` : 'No students registered yet.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Name</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Index Number</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Email</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Level</th>
                    {isBtechCSLevel100 && <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-3 px-2 font-medium text-gray-900 dark:text-gray-100">{s.full_name}</td>
                      <td className="py-3 px-2 text-gray-600 dark:text-gray-400">{s.index_number}</td>
                      <td className="py-3 px-2 text-gray-600 dark:text-gray-400">{s.email}</td>
                      <td className="py-3 px-2 text-gray-600 dark:text-gray-400">{s.level}</td>
                      {isBtechCSLevel100 && (
                        <td className="py-3 px-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveStudent(s.index_number, activeTab === 'A' ? 'B' : 'A')}
                            className="text-primary-500 hover:text-primary-700"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
                            Move to {activeTab === 'A' ? 'B' : 'A'}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { profileService } from '@/services/profileService';
import { useProgramName } from '@/hooks/useProgramName';
import toast from 'react-hot-toast';

export function AdminStudentsPage() {
  const { profile } = useAuth();
  const programName = useProgramName(profile?.program);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!profile?.program || !profile?.level) return;
    profileService.getStudentsByProgram(profile.program, profile.level)
      .then(setStudents)
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoading(false));
  }, [profile?.program, profile?.level]);

  const filtered = students.filter((s) => {
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Students</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{programName} - {profile?.level} &bull; {students.length} students</p>
      </div>

      <Card>
        <CardContent className="p-6">
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
              <p>{search ? 'No students match your search.' : 'No students registered yet.'}</p>
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
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-3 px-2 font-medium text-gray-900 dark:text-gray-100">{s.full_name}</td>
                      <td className="py-3 px-2 text-gray-600 dark:text-gray-400">{s.index_number}</td>
                      <td className="py-3 px-2 text-gray-600 dark:text-gray-400">{s.email}</td>
                      <td className="py-3 px-2 text-gray-600 dark:text-gray-400">{s.level}</td>
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

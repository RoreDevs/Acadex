import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, GraduationCap, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { programService } from '@/services/programService';
import { profileService } from '@/services/profileService';
import { useAuth } from '@/contexts/AuthContext';
import { friendlyErrorMessage } from '@/lib/utils';
import { auditService } from '@/services/auditService';
import toast from 'react-hot-toast';

const LEVELS = ['Level 100', 'Level 200', 'Level 300', 'Level 400'];

const PROMOTION_MAP: Record<string, string> = {
  'Level 100': 'Level 200',
  'Level 200': 'Level 300',
  'Level 300': 'Level 400',
};

export function PromotionsPage() {
  const { profile } = useAuth();
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    programService.getPrograms().then(setPrograms);
  }, []);

  const loadStudents = async () => {
    if (!selectedProgram || !selectedLevel) return;
    setLoading(true);
    const data = await profileService.getStudentsByProgram(selectedProgram, selectedLevel);
    setStudents(data);
    setLoading(false);
  };

  useEffect(() => { loadStudents(); }, [selectedProgram, selectedLevel]);

  const handlePromote = async () => {
    const newLevel = PROMOTION_MAP[selectedLevel];
    if (!newLevel) {
      toast.error('This level cannot be promoted further');
      setConfirmOpen(false);
      return;
    }

    const { error } = await profileService.promoteLevel(selectedProgram, selectedLevel, newLevel);
    if (error) {
      toast.error(friendlyErrorMessage(error, 'Failed to promote students'));
    } else {
      toast.success(`${students.length} students promoted to ${newLevel}!`);
      if (profile) {
        await auditService.logAction(
          profile.id,
          profile.full_name,
          'Level Promotion',
          `Promoted ${students.length} students from ${selectedLevel} to ${newLevel}`
        );
      }
      setConfirmOpen(false);
      loadStudents();
    }
  };

  const newLevel = PROMOTION_MAP[selectedLevel];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Level Promotion</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Promote students to the next academic level</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Program</Label>
              <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                <SelectTrigger>
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Current Level</Label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedProgram && selectedLevel && (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary-500" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Students in this class</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {loading ? '...' : students.length}
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedProgram && selectedLevel && newLevel && (
            <Button
              size="lg"
              className="w-full"
              onClick={() => setConfirmOpen(true)}
              disabled={students.length === 0 || loading}
            >
              <ArrowUp className="w-4 h-4 mr-2" />
              Promote {students.length} Students from {selectedLevel} to {newLevel}
            </Button>
          )}

          {selectedProgram && selectedLevel && !newLevel && (
            <p className="text-center text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
              This is the highest level. Students at {selectedLevel} cannot be promoted further.
            </p>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm Bulk Promotion"
        description={`Are you sure you want to promote ${students.length} students from ${selectedLevel} to ${newLevel}? This action will be logged.`}
        onConfirm={handlePromote}
        confirmText={`Promote ${students.length} Students`}
        confirmVariant="default"
      />
    </motion.div>
  );
}

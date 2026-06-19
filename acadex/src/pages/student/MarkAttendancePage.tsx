import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { QrCode, CheckCircle, XCircle, ArrowRight, ScanLine, Clock, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { sessionService } from '@/services/sessionService';
import { attendanceService } from '@/services/attendanceService';
import toast from 'react-hot-toast';

const codeSchema = z.object({
  code: z.string().min(6, 'Code must be at least 6 characters'),
});

type CodeForm = z.infer<typeof codeSchema>;

const INITIAL_CLASS_A: string[] = [
  "B202250058",
];

export function MarkAttendancePage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
  });

  const onSubmit = async (data: CodeForm) => {
    if (!profile) return;
    setLoading(true);
    setSuccess(false);
    setSessionInfo(null);

    try {
      const session = await sessionService.getSessionByCode(data.code.toUpperCase());

      if (!session) {
        toast.error('Session not found. Please check your code.');
        setLoading(false);
        return;
      }

      if (!session.is_active) {
        toast.error('Session has ended.');
        setLoading(false);
        return;
      }

      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (session.session_date < today) {
        toast.error('Session date has passed.');
        setLoading(false);
        return;
      }

      const [y, m, d] = session.session_date.split('-').map(Number);
      const [hh, mm, ss = '0'] = session.end_time.split(':');
      const sessionEnd = new Date(y, m - 1, d, +hh, +mm, +ss);
      if (now > sessionEnd) {
        toast.error('Session has ended.');
        setLoading(false);
        return;
      }

      if (session.class) {
        const studentClass = INITIAL_CLASS_A.includes(profile.index_number || '') ? 'A' : 'B';
        if (studentClass !== session.class) {
          toast.error(`This code is for Class ${session.class} only. You are in Class ${studentClass}.`);
          setLoading(false);
          return;
        }
      }

      const alreadyAttended = await attendanceService.checkAttendance(session.id, profile.id);
      if (alreadyAttended) {
        toast.error('You have already marked attendance for this session.');
        setLoading(false);
        return;
      }

      const { error } = await attendanceService.markAttendance(profile.id, session.id);
      if (error) {
        toast.error(error.message);
      } else {
        setSessionInfo(session);
        setSuccess(true);
        toast.success('Attendance marked successfully!');
        reset();
      }
    } catch (err) {
      toast.error('Failed to process attendance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mark Attendance</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Enter the session code provided by your lecturer</p>
      </div>

      <Card>
        <CardContent className="p-8">
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
              <ScanLine className="w-10 h-10 text-primary-500" />
            </div>
          </div>

          {success && sessionInfo ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Attendance Confirmed!</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{sessionInfo.title}</p>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <BookOpen className="w-4 h-4" />
                {sessionInfo.courses?.title}
                <Clock className="w-4 h-4 ml-2" />
                {sessionInfo.start_time} - {sessionInfo.end_time}
              </div>
              <Badge variant="success" className="text-sm px-4 py-1">
                Present
              </Badge>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => { setSuccess(false); setSessionInfo(null); }}
              >
                Mark Another
              </Button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="code">Session Code</Label>
                <Input
                  id="code"
                  placeholder="ICT101-AB12"
                  className="text-center text-lg tracking-widest font-mono uppercase"
                  {...register('code')}
                  error={errors.code?.message}
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </div>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 mr-2" />
                    Mark Attendance
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How it works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-500 dark:text-gray-400 space-y-2">
          <p>1. Your lecturer will display a session code during class.</p>
          <p>2. Enter the code exactly as shown (case-insensitive).</p>
          <p>3. Your attendance will be recorded automatically.</p>
          <p>4. You'll receive a confirmation once successful.</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

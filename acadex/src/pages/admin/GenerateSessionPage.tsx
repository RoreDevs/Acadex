import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { QrCode, FileText, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useProgramName } from '@/hooks/useProgramName';
import { courseService } from '@/services/courseService';
import { sessionService } from '@/services/sessionService';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';

const sessionSchema = z.object({
  course_id: z.string().min(1, 'Please select a course'),
  title: z.string().min(2, 'Title must be at least 2 characters'),
  description: z.string().optional(),
  session_date: z.string().min(1, 'Please select a date'),
  start_time: z.string().min(1, 'Please select start time'),
  end_time: z.string().min(1, 'Please select end time'),
});

type SessionForm = z.infer<typeof sessionSchema>;

export function GenerateSessionPage() {
  const { profile } = useAuth();
  const programName = useProgramName(profile?.program);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState<'A' | 'B'>(() => {
    const fromUrl = searchParams.get('class');
    return fromUrl === 'A' || fromUrl === 'B' ? fromUrl : 'A';
  });

  const isBtechCSLevel100 = programName === 'BTECH COMPUTER SCIENCE' && profile?.level === 'Level 100';

  useEffect(() => {
    if (!profile) return;
    courseService.getCoursesByProgram(profile.program!, profile.level!).then(setCourses);
  }, [profile]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SessionForm>({
    resolver: zodResolver(sessionSchema),
  });

  const onSubmit = async (data: SessionForm) => {
    if (!profile) return;
    setLoading(true);

    const course = courses.find((c) => c.id === data.course_id);
    if (!course) {
      toast.error('Course not found');
      setLoading(false);
      return;
    }

    const { error } = await sessionService.createSession({
      course_id: data.course_id,
      title: data.title,
      description: data.description,
      session_date: data.session_date,
      start_time: data.start_time,
      end_time: data.end_time,
      program_id: profile.program!,
      level: profile.level!,
      course_code: course.code,
      ...(isBtechCSLevel100 ? { class: selectedClass } : {}),
    });

    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Session created for Class ${selectedClass}!`);
      navigate('/admin/sessions');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Generate Session</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Create a new attendance session for your class</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label>Course</Label>
              <Select onValueChange={(v) => setValue('course_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} - {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.course_id && (
                <p className="mt-1.5 text-xs text-red-500">{errors.course_id.message}</p>
              )}
            </div>

            {isBtechCSLevel100 && (
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={selectedClass} onValueChange={(v) => setSelectedClass(v as 'A' | 'B')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Class A</SelectItem>
                    <SelectItem value="B">Class B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Session Title</Label>
              <Input id="title" placeholder="e.g., Week 5 Lecture" {...register('title')} error={errors.title?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea id="description" placeholder="Brief description of the session" {...register('description')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session_date">Session Date</Label>
              <Input id="session_date" type="date" {...register('session_date')} error={errors.session_date?.message} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Start Time</Label>
                <Input id="start_time" type="time" {...register('start_time')} error={errors.start_time?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">End Time</Label>
                <Input id="end_time" type="time" {...register('end_time')} error={errors.end_time?.message} />
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating session...
                </div>
              ) : (
                <>
                  <QrCode className="w-4 h-4 mr-2" />
                  Generate Session & Code
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-800">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="text-sm text-primary-800 dark:text-primary-200">
              <p className="font-medium mb-1">Auto-Expiring Session</p>
              <p>Sessions automatically expire at the set end time. You can also end them manually from the sessions page at any time.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Code, UserCheck, GraduationCap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentAcademicPeriod } from '@/contexts/AcademicPeriodContext';
import { courseService } from '@/services/courseService';
import { academicPeriodService } from '@/services/academicPeriodService';
import toast from 'react-hot-toast';

export function CoursesPage() {
  const { profile } = useAuth();
  const { currentSemester, currentYear } = useCurrentAcademicPeriod();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || !profile.program || !profile.level) return;
    const program = profile.program;
    const level = profile.level;
    (async () => {
      try {
        // Current-semester curriculum first: program + level + semester
        // number resolve automatically for each academic year.
        const semNo = currentSemester?.semester_number;
        if (currentSemester?.id && semNo) {
          await academicPeriodService.ensureSemesterOfferings(currentSemester.id).catch(() => null);
          const list = await courseService.getCurriculumCourses(program, level, semNo);
          if (list.length > 0) {
            setCourses(list);
            return;
          }
        }
      } catch {
        // Fall through to the legacy program + level listing below.
      }
      try {
        const data = await courseService.getCoursesByProgram(program, level);
        setCourses(data);
      } catch {
        toast.error('Failed to load courses');
      }
    })().finally(() => setLoading(false));
  }, [profile, currentSemester]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Courses</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {courses.length} course{courses.length !== 1 ? 's' : ''} under your program
          {currentSemester && ` · ${currentSemester.name}${currentYear ? ` (${currentYear.name})` : ''}`}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No courses enrolled yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course: any, i: number) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="h-full hover:shadow-card-hover transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-primary-500" />
                    </div>
                    <Badge variant="outline">{course.level}</Badge>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{course.title}</h3>
                  <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Code className="w-4 h-4" />
                      {course.code}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, BookOpen, File as FileIcon, Clock, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { slideService } from '@/services/slideService';
import toast from 'react-hot-toast';

export function StudentSlidesPage() {
  const { user } = useAuth();
  const [slides, setSlides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    slideService.getSlidesForStudent(user.id)
      .then(setSlides)
      .catch(() => toast.error('Failed to load slides'))
      .finally(() => setLoading(false));
  }, [user]);

  const grouped = slides.reduce<Record<string, any[]>>((acc, slide) => {
    const key = slide.courses?.code || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(slide);
    return acc;
  }, {});

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Course Slides</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{slides.length} slide{slides.length !== 1 ? 's' : ''} available</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : slides.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-gray-500">
            <BookOpen className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
            <p>No slides available for your courses yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([courseCode, courseSlides]) => (
            <div key={courseCode}>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary-500" />
                {courseCode} - {courseSlides[0]?.courses?.title}
                <Badge variant="outline" className="ml-2 text-xs">{courseSlides.length}</Badge>
              </h2>
              <div className="space-y-2">
                {courseSlides.map((slide, i) => (
                  <motion.div
                    key={slide.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between p-4 rounded-xl border bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                        <FileIcon className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{slide.title}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                          <span>{slide.file_name}</span>
                          <span>&middot;</span>
                          <span>{slideService.formatFileSize(slide.file_size || 0)}</span>
                          {slide.profiles?.full_name && (
                            <>
                              <span>&middot;</span>
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {slide.profiles.full_name}
                              </span>
                            </>
                          )}
                          <span>&middot;</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(slide.created_at).toLocaleDateString()}
                          </span>
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild className="shrink-0 ml-2">
                      <a href={slide.file_url} target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4 mr-1.5" />
                        Download
                      </a>
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

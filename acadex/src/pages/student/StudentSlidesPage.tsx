import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, FileText, User, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { slideService } from '@/services/slideService';
import { SlideDetailModal } from '@/components/SlideDetailModal';
import toast from 'react-hot-toast';

export function StudentSlidesPage() {
  const { user } = useAuth();
  const [slides, setSlides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlide, setSelectedSlide] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    slideService.getSlidesForStudent(user.id)
      .then(setSlides)
      .catch(() => toast.error('Failed to load slides'))
      .finally(() => setLoading(false));
  }, [user]);

  const handleSlideClick = (slide: any) => {
    setSelectedSlide(slide);
    setIsModalOpen(true);
  };

  const grouped = slides.reduce<Record<string, any[]>>((acc, slide) => {
    const key = slide.courses?.code || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(slide);
    return acc;
  }, {});

  const newestSlide = slides.length > 0 ? slides[0] : null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Slides</h1>
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
          {newestSlide && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => handleSlideClick(newestSlide)}
              className="rounded-xl border-2 border-primary-500/30 bg-gradient-to-br from-primary-50 to-primary-50/50 dark:from-primary-900/20 dark:to-primary-900/5 p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-primary-600 hover:bg-primary-700">Latest</Badge>
                    <p className="text-xs text-gray-500">{newestSlide.courses?.code}</p>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{newestSlide.title}</h3>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {newestSlide.profiles?.full_name && (
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {newestSlide.profiles.full_name}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {new Date(newestSlide.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div className="space-y-6">
            {Object.entries(grouped).map(([courseCode, courseSlides]) => (
              <div key={courseCode}>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary-500" />
                  {courseCode} - {courseSlides[0]?.courses?.title}
                  <Badge variant="outline" className="ml-2 text-xs">{courseSlides.length}</Badge>
                </h2>
                <div className="space-y-2">
                  {courseSlides.filter(s => !newestSlide || s.id !== newestSlide.id).map((slide, i) => (
                    <motion.div
                      key={slide.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => handleSlideClick(slide)}
                      className="flex items-start gap-3 p-4 rounded-xl border bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:shadow-sm transition-shadow cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{slide.title}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
                          {slide.profiles?.full_name && (
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {slide.profiles.full_name}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(slide.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <SlideDetailModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        slide={selectedSlide}
      />
    </motion.div>
  );
}

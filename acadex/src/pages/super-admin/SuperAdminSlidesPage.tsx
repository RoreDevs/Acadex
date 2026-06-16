import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, BookOpen, FileText, Clock, User, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { slideService } from '@/services/slideService';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import toast from 'react-hot-toast';

export function SuperAdminSlidesPage() {
  const [slides, setSlides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingSlideId, setDeletingSlideId] = useState<string | null>(null);

  const loadSlides = () => {
    setLoading(true);
    slideService.getAllSlides()
      .then(setSlides)
      .catch(() => toast.error('Failed to load slides'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSlides(); }, []);

  const handleDelete = async () => {
    if (!deletingSlideId) return;
    const { error } = await slideService.deleteSlide(deletingSlideId);
    if (error) { toast.error(error.message); return; }
    toast.success('Slide deleted');
    setSlides((prev) => prev.filter((s) => s.id !== deletingSlideId));
    setDeleteOpen(false);
    setDeletingSlideId(null);
  };

  const filtered = slides.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    (s.courses?.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.courses?.code || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">All Slides</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{slides.length} slide{slides.length !== 1 ? 's' : ''} across all programs</p>
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search slides..."
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-gray-500">
            <BookOpen className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
            <p>{search ? 'No slides match your search' : 'No slides uploaded yet'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((slide, i) => (
            <motion.div
              key={slide.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-primary-600 dark:text-primary-400 text-sm">
                      {slide.courses?.code}
                    </p>
                    <span className="text-gray-500">&bull;</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{slide.courses?.title}</p>
                  </div>
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
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline" size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => { setDeletingSlideId(slide.id); setDeleteOpen(true); }}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Delete
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Slide"
        description="Are you sure you want to delete this slide? This action cannot be undone."
        onConfirm={handleDelete}
        confirmText="Delete"
      />
    </motion.div>
  );
}

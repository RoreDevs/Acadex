import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Upload, Trash2, BookOpen, Download,
  ChevronDown, ChevronRight, File as FileIcon
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { courseService } from '@/services/courseService';
import { slideService } from '@/services/slideService';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import toast from 'react-hot-toast';

export function AdminSlidesPage() {
  const { profile } = useAuth();
  const programId = profile?.program;
  const [courses, setCourses] = useState<any[]>([]);
  const [slidesByCourse, setSlidesByCourse] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [slideTitle, setSlideTitle] = useState('');
  const [slideFile, setSlideFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingSlideId, setDeletingSlideId] = useState<string | null>(null);

  const loadData = async () => {
    if (!profile || !programId) return;
    setLoading(true);
    try {
      const coursesData = await courseService.getCoursesByProgram(programId, profile.level!);
      setCourses(coursesData);
      const slidesMap: Record<string, any[]> = {};
      for (const course of coursesData) {
        const slides = await slideService.getSlidesByCourse(course.id);
        slidesMap[course.id] = slides;
      }
      setSlidesByCourse(slidesMap);
    } catch {
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  const loadSlidesForCourse = async (courseId: string) => {
    const slides = await slideService.getSlidesByCourse(courseId);
    setSlidesByCourse((prev) => ({ ...prev, [courseId]: slides }));
  };

  useEffect(() => { loadData(); }, [profile]);

  const handleUpload = async () => {
    if (!selectedCourseId || !slideTitle || !slideFile || !profile || !programId) {
      toast.error('Please fill all fields');
      return;
    }
    setUploading(true);
    const { error } = await slideService.uploadSlide(slideFile, {
      title: slideTitle,
      course_id: selectedCourseId,
      program_id: programId,
      uploaded_by: profile.id,
    });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Slide uploaded');
    setUploadOpen(false);
    setSelectedCourseId('');
    setSlideTitle('');
    setSlideFile(null);
    await loadSlidesForCourse(selectedCourseId);
  };

  const handleDelete = async () => {
    if (!deletingSlideId) return;
    const { error } = await slideService.deleteSlide(deletingSlideId);
    if (error) { toast.error(error.message); return; }
    toast.success('Slide deleted');
    setDeleteOpen(false);
    setDeletingSlideId(null);
    for (const cId of Object.keys(slidesByCourse)) {
      if (slidesByCourse[cId].some((s) => s.id === deletingSlideId)) {
        await loadSlidesForCourse(cId);
        break;
      }
    }
  };

  const toggleCourse = (courseId: string) => {
    setExpandedCourse(expandedCourse === courseId ? null : courseId);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Course Slides</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Upload and manage slides for your courses</p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Upload Slide
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Course Slide</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} - {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Slide Title</Label>
                <Input value={slideTitle} onChange={(e) => setSlideTitle(e.target.value)} placeholder="e.g. Week 1 - Introduction" />
              </div>
              <div className="space-y-2">
                <Label>File</Label>
                <Input type="file" onChange={(e) => setSlideFile(e.target.files?.[0] || null)} accept=".pdf,.ppt,.pptx,.doc,.docx,.txt" />
                {slideFile && (
                  <p className="text-xs text-gray-500">{slideFile.name} ({slideService.formatFileSize(slideFile.size)})</p>
                )}
              </div>
              <Button className="w-full" onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-gray-500">
            <BookOpen className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
            <p>No courses assigned to your program</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => {
            const slides = slidesByCourse[course.id] || [];
            const isExpanded = expandedCourse === course.id;
            return (
              <Card key={course.id} className="overflow-hidden">
                <button
                  onClick={() => toggleCourse(course.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-primary-500 shrink-0" />
                    <div className="text-left">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{course.title}</p>
                      <p className="text-sm text-gray-500">{course.code} &middot; {slides.length} slide{slides.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700">
                    {slides.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">No slides uploaded for this course</div>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {slides.map((slide, i) => (
                          <motion.div
                            key={slide.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="flex items-center justify-between p-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileIcon className="w-5 h-5 text-blue-500 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{slide.title}</p>
                                <p className="text-xs text-gray-500">
                                  {slide.file_name} &middot; {slideService.formatFileSize(slide.file_size || 0)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <Button variant="ghost" size="icon" asChild>
                                <a href={slide.file_url} target="_blank" rel="noopener noreferrer" title="Download">
                                  <Download className="w-4 h-4" />
                                </a>
                              </Button>
                              <Button
                                variant="ghost" size="icon"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                onClick={() => { setDeletingSlideId(slide.id); setDeleteOpen(true); }}
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Slide"
        description="Are you sure you want to delete this slide?"
        onConfirm={handleDelete}
        confirmText="Delete"
      />
    </motion.div>
  );
}

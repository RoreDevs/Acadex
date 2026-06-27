import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, BookOpen, Hash, Shield, Camera, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useProgramName } from '@/hooks/useProgramName';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import toast from 'react-hot-toast';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  index_number: z.string().min(5, 'Index number must be at least 5 characters'),
});

type ProfileForm = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const { profile, updateProfile, deleteAccount } = useAuth();
  const programName = useProgramName(profile?.program);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name || '',
      index_number: profile?.index_number || '',
    },
  });

  const onSubmit = async (data: ProfileForm) => {
    setLoading(true);
    const { error } = await updateProfile(data);
    setLoading(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Profile updated successfully');
    }
  };

  const handleDelete = async () => {
    const { error } = await deleteAccount();
    if (error) toast.error(error);
  };

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const roleColors: Record<string, string> = {
    student: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    admin: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Profile</h1>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
            <div className="relative">
              <Avatar className="w-24 h-24 ring-4 ring-gray-100 dark:ring-gray-700">
                <AvatarFallback className="bg-primary-500 text-white text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-md hover:bg-primary-600 transition-colors">
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{profile?.full_name}</h2>
              <p className="text-gray-500 dark:text-gray-400">{profile?.email}</p>
              <Badge className={`mt-2 ${roleColors[profile?.role || 'student']}`}>
                {profile?.role?.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </div>

          <Separator className="mb-6" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <Hash className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Index Number</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{profile?.index_number}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <BookOpen className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Program</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{programName || profile?.program}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Level</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{profile?.level}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <Shield className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Role</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{profile?.role?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          <Separator className="mb-6" />

          {!editing ? (
            <div className="flex justify-center sm:justify-start">
              <Button onClick={() => setEditing(true)} variant="outline">
                Edit Profile
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Profile</h3>

              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input id="full_name" {...register('full_name')} error={errors.full_name?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="index_number">Index Number</Label>
                <Input id="index_number" {...register('index_number')} error={errors.index_number?.message} />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={loading}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Account
          </Button>
        </CardContent>
      </Card>

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Account"
        description="Are you sure you want to delete your account? This action cannot be undone. All your attendance data will be permanently removed."
        onConfirm={handleDelete}
        confirmText="Delete My Account"
      />
    </motion.div>
  );
}

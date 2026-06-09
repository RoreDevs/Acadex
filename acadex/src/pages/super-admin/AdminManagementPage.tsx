import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, UserPlus, UserMinus, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/DataTable';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { profileService } from '@/services/profileService';
import { auditService } from '@/services/auditService';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';

export function AdminManagementPage() {
  const { profile: currentUser } = useAuth();
  const [admins, setAdmins] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [demoteOpen, setDemoteOpen] = useState(false);
  const [newRole, setNewRole] = useState<'admin' | 'super_admin'>('admin');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');

  const loadData = async () => {
    try {
      const [a, s] = await Promise.all([
        profileService.getAllAdmins(),
        profileService.getAllStudents(),
      ]);
      setAdmins(a);
      setStudents(s);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handlePromote = async () => {
    if (!selectedUser) return;
    const { error } = await profileService.updateRole(selectedUser.id, newRole);
    if (error) toast.error(error.message);
    else {
      toast.success(`${selectedUser.full_name} promoted to ${newRole}`);
      if (currentUser) {
        await auditService.logAction(currentUser.id, currentUser.full_name, 'Promote User', `Promoted ${selectedUser.full_name} to ${newRole}`);
      }
      setPromoteOpen(false);
      setSelectedUser(null);
      loadData();
    }
  };

  const handleDemote = async () => {
    if (!selectedUser) return;
    const { error } = await profileService.updateRole(selectedUser.id, 'student');
    if (error) toast.error(error.message);
    else {
      toast.success(`${selectedUser.full_name} demoted to student`);
      if (currentUser) {
        await auditService.logAction(currentUser.id, currentUser.full_name, 'Demote User', `Demoted ${selectedUser.full_name} to student`);
      }
      setDemoteOpen(false);
      setSelectedUser(null);
      loadData();
    }
  };

  const handleAddAdmin = async () => {
    if (!selectedStudent) return;
    const student = students.find((s) => s.id === selectedStudent);
    if (!student) return;
    const { error } = await profileService.updateRole(selectedStudent, 'admin');
    if (error) toast.error(error.message);
    else {
      toast.success(`${student.full_name} is now an admin`);
      if (currentUser) {
        await auditService.logAction(currentUser.id, currentUser.full_name, 'Add Admin', `Added ${student.full_name} as admin`);
      }
      setAddDialogOpen(false);
      setSelectedStudent('');
      loadData();
    }
  };

  const columns = [
    { key: 'full_name', header: 'Full Name', render: (item: any) => (
      <span className="font-medium">{item.full_name}</span>
    )},
    { key: 'email', header: 'Email' },
    { key: 'program', header: 'Program' },
    { key: 'role', header: 'Role', render: (item: any) => (
      <Badge className={item.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}>
        {item.role.replace('_', ' ').toUpperCase()}
      </Badge>
    )},
    { key: 'actions', header: 'Actions', sortable: false, render: (item: any) => (
      <div className="flex gap-2">
        {item.role !== 'super_admin' && (
          <>
            <Button variant="ghost" size="sm" onClick={(e) => {
              e.stopPropagation();
              setSelectedUser(item);
              setNewRole('super_admin');
              setPromoteOpen(true);
            }}>
              <ArrowUpDown className="w-4 h-4 mr-1" />
              Promote
            </Button>
            <Button variant="ghost" size="sm" className="text-red-500" onClick={(e) => {
              e.stopPropagation();
              setSelectedUser(item);
              setDemoteOpen(true);
            }}>
              <UserMinus className="w-4 h-4 mr-1" />
              Demote
            </Button>
          </>
        )}
      </div>
    )},
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{admins.length} total admins</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Add Admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Admin</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Student</Label>
                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.full_name} - {s.index_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleAddAdmin} disabled={!selectedStudent}>
                Make Admin
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <DataTable columns={columns} data={admins} searchPlaceholder="Search admins..." />
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
        title="Promote User"
        description={`Promote ${selectedUser?.full_name} to ${newRole.replace('_', ' ')}?`}
        onConfirm={handlePromote}
        confirmText="Promote"
        confirmVariant="default"
      />

      <ConfirmModal
        open={demoteOpen}
        onOpenChange={setDemoteOpen}
        title="Demote User"
        description={`Demote ${selectedUser?.full_name} back to student?`}
        onConfirm={handleDemote}
        confirmText="Demote to Student"
      />
    </motion.div>
  );
}

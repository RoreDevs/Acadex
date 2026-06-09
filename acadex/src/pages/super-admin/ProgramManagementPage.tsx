import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { DataTable } from '@/components/shared/DataTable';
import { programService } from '@/services/programService';
import { exportToCSV } from '@/utils/export';
import { useAuth } from '@/contexts/AuthContext';
import { auditService } from '@/services/auditService';
import toast from 'react-hot-toast';

export function ProgramManagementPage() {
  const { profile } = useAuth();
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const loadPrograms = () => {
    programService.getPrograms()
      .then(setPrograms)
      .catch(() => toast.error('Failed to load programs'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPrograms(); }, []);

  const resetForm = () => {
    setName('');
    setCode('');
    setEditing(null);
  };

  const openEdit = (program: any) => {
    setEditing(program);
    setName(program.name);
    setCode(program.code);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name || !code) { toast.error('Please fill all fields'); return; }
    if (editing) {
      const { error } = await programService.updateProgram(editing.id, { name, code });
      if (error) toast.error(error.message);
      else {
        toast.success('Program updated');
        if (profile) await auditService.logAction(profile.id, profile.full_name, 'Update Program', `Updated ${editing.name}`);
      }
    } else {
      const { error } = await programService.createProgram({ name, code });
      if (error) toast.error(error.message);
      else {
        toast.success('Program created');
        if (profile) await auditService.logAction(profile.id, profile.full_name, 'Create Program', `Created ${name}`);
      }
    }
    setDialogOpen(false);
    resetForm();
    loadPrograms();
  };

  const handleDelete = async () => {
    setDeleteOpen(false);
  };

  const columns = [
    { key: 'name', header: 'Name', render: (item: any) => <span className="font-medium">{item.name}</span> },
    { key: 'code', header: 'Code' },
    { key: 'actions', header: 'Actions', sortable: false, render: (item: any) => (
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(item); }}>
          <Edit className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" className="text-red-500" onClick={(e) => {
          e.stopPropagation();
          setEditing(item);
          setDeleteOpen(true);
        }}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    )},
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Program Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{programs.length} programs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (programs.length === 0) return;
            exportToCSV(programs.map((p) => ({ Name: p.name, Code: p.code })), 'programs');
            toast.success('CSV exported');
          }}>Export CSV</Button>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Add Program</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Program' : 'Add Program'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Program Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., BTECH ICT" />
                </div>
                <div className="space-y-2">
                  <Label>Program Code</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., BTECH-ICT" />
                </div>
                <Button className="w-full" onClick={handleSave}>
                  {editing ? 'Update' : 'Create'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <DataTable columns={columns} data={programs} searchPlaceholder="Search programs..." />
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Program"
        description={`Are you sure you want to delete ${editing?.name}? This will also remove all courses associated with this program.`}
        onConfirm={handleDelete}
      />
    </motion.div>
  );
}

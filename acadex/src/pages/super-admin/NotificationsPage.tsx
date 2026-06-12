import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Bell, Trash2, User, Clock, Info, CheckCircle, AlertTriangle, XCircle,
  Send, Edit3, Eye, CheckCheck, Users, RotateCcw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { notificationService } from '@/services/notificationService';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

const typeIcons: Record<string, React.ReactNode> = {
  info: <Info className="w-5 h-5 text-blue-500" />,
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  error: <XCircle className="w-5 h-5 text-red-500" />,
};

const typeVariants: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  info: 'default',
  success: 'success',
  warning: 'warning',
  error: 'danger',
};

export function NotificationsPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('active');
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'success' | 'warning' | 'error'>('info');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'permanent-delete' | null>(null);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editingBroadcast, setEditingBroadcast] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editType, setEditType] = useState<'info' | 'success' | 'warning' | 'error'>('info');

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsData, setDetailsData] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadBroadcasts = () => {
    if (!profile) return;
    setLoading(true);
    const promise = tab === 'active'
      ? notificationService.getSentBroadcasts(profile.id)
      : notificationService.getTrashBroadcasts(profile.id);
    promise
      .then(setBroadcasts)
      .catch(() => toast.error('Failed to load notifications'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (profile) loadBroadcasts(); }, [profile, tab]);

  const handleSend = async () => {
    if (!title || !message) { toast.error('Please fill all fields'); return; }
    if (!profile) return;
    setSending(true);
    const { error, count } = await notificationService.sendToAllUsers({
      title, message, type, sender_id: profile.id
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Notification sent to ${count} users`);
    setSendOpen(false);
    setTitle('');
    setMessage('');
    setType('info');
    loadBroadcasts();
  };

  const handleConfirmAction = async () => {
    if (!selectedBroadcastId) return;
    if (confirmAction === 'delete') {
      const { error } = await notificationService.softDeleteBroadcast(selectedBroadcastId);
      if (error) { toast.error(error.message); return; }
      setBroadcasts((prev) => prev.filter((b) => b.broadcast_id !== selectedBroadcastId));
      toast.success('Broadcast moved to trash');
    } else {
      const { error } = await notificationService.permanentlyDeleteBroadcast(selectedBroadcastId);
      if (error) { toast.error(error.message); return; }
      setBroadcasts((prev) => prev.filter((b) => b.broadcast_id !== selectedBroadcastId));
      toast.success('Broadcast permanently deleted');
    }
    setConfirmOpen(false);
    setSelectedBroadcastId(null);
    setConfirmAction(null);
  };

  const handleRestore = async (broadcastId: string) => {
    const { error } = await notificationService.restoreBroadcast(broadcastId);
    if (error) { toast.error(error.message); return; }
    toast.success('Broadcast restored');
    loadBroadcasts();
  };

  const handleEdit = (broadcast: any) => {
    setEditingBroadcast(broadcast);
    setEditTitle(broadcast.title);
    setEditMessage(broadcast.message);
    setEditType(broadcast.type);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingBroadcast || !editTitle || !editMessage) return;
    const { error } = await notificationService.updateBroadcast(editingBroadcast.broadcast_id, {
      title: editTitle,
      message: editMessage,
      type: editType,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Broadcast updated');
    setEditOpen(false);
    setEditingBroadcast(null);
    loadBroadcasts();
  };

  const handleViewDetails = async (broadcastId: string) => {
    setDetailsLoading(true);
    setDetailsOpen(true);
    const data = await notificationService.getBroadcastDetails(broadcastId);
    setDetailsData(data);
    setDetailsLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {tab === 'active' ? 'Sent Notifications' : 'Trash Bin'}
        </h1>
        {tab === 'active' && (
          <Dialog open={sendOpen} onOpenChange={setSendOpen}>
            <DialogTrigger asChild>
              <Button>
                <Send className="w-4 h-4 mr-2" />
                Send Notification
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Notification to All Users</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notification title" />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your message..." rows={4} />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v: any) => setType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleSend} disabled={sending}>
                  {sending ? 'Sending...' : 'Send to All Users'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="active" className="gap-2">
              <Bell className="w-4 h-4" />
              Active
            </TabsTrigger>
            <TabsTrigger value="trash" className="gap-2">
              <Trash2 className="w-4 h-4" />
              Trash
            </TabsTrigger>
          </TabsList>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tab === 'active'
              ? `${broadcasts.length} active broadcast${broadcasts.length !== 1 ? 's' : ''}`
              : `${broadcasts.length} deleted broadcast${broadcasts.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>

        <TabsContent value="active">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : broadcasts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Bell className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
                <p>No broadcasts sent yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {broadcasts.map((b, i) => (
                <motion.div
                  key={b.broadcast_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="rounded-xl border bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                      {typeIcons[b.type] || typeIcons.info}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{b.title}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{b.message}</p>
                        </div>
                        <Badge variant={typeVariants[b.type] || 'default'} className="text-xs shrink-0">
                          {b.type}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-gray-400 dark:text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(b.created_at).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Send className="w-3 h-3" />
                          Sent to {b.total_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCheck className="w-3 h-3" />
                          Read by {b.read_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {b.total_count > 0 ? Math.round((b.read_count / b.total_count) * 100) : 0}% read
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Button variant="outline" size="sm" onClick={() => handleViewDetails(b.broadcast_id)}>
                          <Eye className="w-3.5 h-3.5 mr-1.5" /> View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(b)}>
                          <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                          onClick={() => {
                            setSelectedBroadcastId(b.broadcast_id);
                            setConfirmAction('delete');
                            setConfirmOpen(true);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trash">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : broadcasts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Trash2 className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
                <p>Trash is empty</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {broadcasts.map((b, i) => (
                <motion.div
                  key={b.broadcast_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="rounded-xl border bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-800 p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                      {typeIcons[b.type] || typeIcons.info}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{b.title}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{b.message}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="danger" className="text-xs">Deleted</Badge>
                          <Badge variant={typeVariants[b.type] || 'default'} className="text-xs">{b.type}</Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-gray-400 dark:text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(b.created_at).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Send className="w-3 h-3" />
                          Sent to {b.total_count}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Button variant="outline" size="sm" onClick={() => handleViewDetails(b.broadcast_id)}>
                          <Eye className="w-3.5 h-3.5 mr-1.5" /> View
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 border-green-200 dark:border-green-800"
                          onClick={() => handleRestore(b.broadcast_id)}
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Restore
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                          onClick={() => {
                            setSelectedBroadcastId(b.broadcast_id);
                            setConfirmAction('permanent-delete');
                            setConfirmOpen(true);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Forever
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmAction === 'delete' ? 'Delete Broadcast' : 'Permanently Delete Broadcast'}
        description={
          confirmAction === 'delete'
            ? 'This will move the broadcast to trash. Users will no longer see this notification.'
            : 'This will permanently delete this broadcast for everyone. This action cannot be undone.'
        }
        onConfirm={handleConfirmAction}
        confirmText={confirmAction === 'delete' ? 'Move to Trash' : 'Delete Forever'}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Broadcast</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={editMessage} onChange={(e) => setEditMessage(e.target.value)} rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={editType} onValueChange={(v: any) => setEditType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Broadcast Recipients</DialogTitle>
          </DialogHeader>
          {detailsLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {detailsData.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No recipients found</p>
              ) : (
                detailsData.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {n.profiles?.full_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {n.profiles?.email} &middot; {n.profiles?.role?.replace('_', ' ') || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <Badge variant={n.read ? 'success' : 'default'} className="text-xs shrink-0 ml-2">
                      {n.read ? 'Read' : 'Unread'}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
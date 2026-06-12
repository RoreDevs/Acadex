import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, Trash2, CheckCheck, User, Clock, Info, CheckCircle, AlertTriangle, XCircle, Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
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
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'success' | 'warning' | 'error'>('info');

  const loadNotifications = () => {
    notificationService.getAllNotifications()
      .then(setNotifications)
      .catch(() => toast.error('Failed to load notifications'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadNotifications(); }, []);

  const handleMarkRead = async (id: string) => {
    const { error } = await notificationService.markAsRead(id);
    if (error) toast.error(error.message);
    else {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    }
  };

  const handleSend = async () => {
    if (!title || !message) { toast.error('Please fill all fields'); return; }
    setSending(true);
    const { error, count } = await notificationService.sendToAllUsers({ title, message, type });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Notification sent to ${count} users`);
    setSendOpen(false);
    setTitle('');
    setMessage('');
    setType('info');
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) { toast.success('All already read'); return; }
    const { error } = await notificationService.markAllAsRead();
    if (error) toast.error(error.message);
    else {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success('All marked as read');
    }
  };

  const handleDelete = async () => {
    if (!selectedNotification) return;
    const { error } = await notificationService.deleteNotification(selectedNotification.id);
    if (error) toast.error(error.message);
    else {
      setNotifications((prev) => prev.filter((n) => n.id !== selectedNotification.id));
      toast.success('Notification deleted');
      setDeleteOpen(false);
      setSelectedNotification(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notifications</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{notifications.filter((n) => !n.read).length} unread</p>
        </div>
        <div className="flex gap-2">
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
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark All Read
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Bell className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
            <p>No notifications yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className={`rounded-xl border p-4 transition-all duration-200 ${
                n.read
                  ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                  : 'bg-primary-50/50 dark:bg-primary-900/10 border-primary-100 dark:border-primary-800'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  {typeIcons[n.type] || typeIcons.info}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{n.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{n.message}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={typeVariants[n.type] || 'default'} className="text-xs">
                        {n.type}
                      </Badge>
                      {!n.read && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-primary-500 transition-colors"
                          title="Mark as read"
                        >
                          <CheckCheck className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedNotification(n);
                          setDeleteOpen(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {n.profiles?.full_name || 'System'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Notification"
        description="Are you sure you want to delete this notification?"
        onConfirm={handleDelete}
        confirmText="Delete"
      />
    </motion.div>
  );
}

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import { Calendar, Clock, QrCode, Trash2, Play, Pause, Ban, Copy, RefreshCw, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { sessionService } from '@/services/sessionService';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { useRealtimeSubscription } from '@/hooks/useRealtime';
import toast from 'react-hot-toast';

const statusMeta: Record<string, { label: string; variant: 'default' | 'success' | 'outline' | 'danger' }> = {
  scheduled: { label: 'Scheduled', variant: 'default' },
  open: { label: 'Open', variant: 'success' },
  closed: { label: 'Closed', variant: 'outline' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
};

export function SessionManagementPage() {
  const { profile } = useAuth();
  const { data: sessions, isLoading } = useRealtimeSubscription<any>('sessions', `program_id.eq.${profile?.program}`);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [qrSession, setQrSession] = useState<any>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!profile) return null;

  const filteredSessions = (sessions || []).filter(
    (s: any) => s.program_id === profile.program && s.level === profile.level
  );

  useEffect(() => {
    if (!qrSession) return;
    let cancelled = false;
    const url = qrSession.qr_code?.startsWith('/')
      ? `${window.location.origin}${qrSession.qr_code}`
      : qrSession.qr_code || `${window.location.origin}/attendance/${qrSession.attendance_code}`;
    QRCode.toDataURL(url, { width: 280, margin: 2 })
      .then((dataUrl) => { if (!cancelled) setQrUrl(dataUrl); })
      .catch(() => { if (!cancelled) setQrUrl(null); });
    return () => { cancelled = true; };
  }, [qrSession]);

  const handleSetStatus = async (id: string, status: 'open' | 'closed' | 'cancelled') => {
    setBusyId(id);
    const { error } = await sessionService.setSessionStatus(id, status);
    setBusyId(null);
    if (error) toast.error(error.message);
    else toast.success(`Session ${status === 'cancelled' ? 'cancelled' : status === 'open' ? 'opened' : 'closed'}`);
  };

  const handleDeleteSession = async () => {
    if (!selectedSession) return;
    const { error } = await sessionService.deleteSession(selectedSession.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Session deleted');
      setDeleteOpen(false);
      setSelectedSession(null);
    }
  };

  const handleRegenerate = async () => {
    if (!selectedSession) return;
    const { data, error } = await sessionService.regenerateCode(selectedSession.id);
    setRegenerateOpen(false);
    setSelectedSession(null);
    if (error) toast.error(error.message);
    else toast.success(`New code generated: ${data?.attendance_code}`);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Session Management</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage attendance sessions and their lifecycle</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Calendar className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
            <p>No sessions created yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session: any, i: number) => {
            const meta = statusMeta[session.status] || statusMeta.scheduled;
            const busy = busyId === session.id;
            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="hover:shadow-card-hover transition-all duration-200">
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          session.status === 'open'
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : session.status === 'cancelled'
                            ? 'bg-red-100 dark:bg-red-900/30'
                            : 'bg-gray-100 dark:bg-gray-700'
                        }`}>
                          <QrCode className={`w-6 h-6 ${
                            session.status === 'open'
                              ? 'text-green-600 dark:text-green-400'
                              : session.status === 'cancelled'
                              ? 'text-red-500'
                              : 'text-gray-400 dark:text-gray-500'
                          }`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{session.title}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{session.courses?.title}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-400 dark:text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(session.session_date).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {session.start_time} - {session.end_time}
                            </span>
                            {session.venue && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {session.venue}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                            <button
                              onClick={() => copyCode(session.attendance_code)}
                              className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-600 font-medium"
                            >
                              <Copy className="w-3 h-3" />
                              {session.attendance_code}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setQrSession(session); setQrUrl(null); }}
                        >
                          <QrCode className="w-4 h-4 mr-1" />
                          QR
                        </Button>
                        {session.status !== 'cancelled' && (
                          <>
                            {session.status === 'scheduled' && (
                              <Button variant="outline" size="sm" disabled={busy} onClick={() => handleSetStatus(session.id, 'open')}>
                                <Play className="w-4 h-4 mr-1" />
                                Open
                              </Button>
                            )}
                            {session.status === 'open' && (
                              <Button variant="outline" size="sm" disabled={busy} onClick={() => handleSetStatus(session.id, 'closed')}>
                                <Pause className="w-4 h-4 mr-1" />
                                Close
                              </Button>
                            )}
                            {session.status === 'closed' && (
                              <Button variant="outline" size="sm" disabled={busy} onClick={() => handleSetStatus(session.id, 'open')}>
                                <Play className="w-4 h-4 mr-1" />
                                Reopen
                              </Button>
                            )}
                            {session.status !== 'open' && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() => handleSetStatus(session.id, 'cancelled')}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <Ban className="w-4 h-4 mr-1" />
                                Cancel
                              </Button>
                            )}
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setSelectedSession(session); setRegenerateOpen(true); }}
                          title="Regenerate attendance code"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => {
                            setSelectedSession(session);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Session"
        description="Are you sure you want to delete this session? This action cannot be undone. All attendance records for this session will also be removed."
        onConfirm={handleDeleteSession}
        confirmText="Delete Session"
      />

      <ConfirmModal
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        title="Regenerate Session Code"
        description={`Generate a new attendance code for "${selectedSession?.title || 'this session'}"? The old code will stop working immediately and students will need the new code.`}
        onConfirm={handleRegenerate}
        confirmText="Regenerate Code"
      />

      <Dialog open={!!qrSession} onOpenChange={(open) => { if (!open) setQrSession(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Attendance QR Code</DialogTitle>
            <DialogDescription>
              Students scan this to open the attendance page for {qrSession?.title}. They must still be enrolled, in the classroom, and inside the open window.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {qrUrl ? (
              <img src={qrUrl} alt="Attendance QR code" className="w-56 h-56 rounded-xl" />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <code className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 text-sm font-mono">{qrSession?.attendance_code}</code>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => copyCode(qrSession?.attendance_code)}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, QrCode, Edit, Trash2, Play, Pause, Copy, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { sessionService } from '@/services/sessionService';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { useRealtimeSubscription } from '@/hooks/useRealtime';
import toast from 'react-hot-toast';

export function SessionManagementPage() {
  const { profile } = useAuth();
  const { data: sessions, isLoading } = useRealtimeSubscription<any>('sessions', `program_id.eq.${profile?.program}`);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);

  if (!profile) return null;

  const filteredSessions = (sessions || []).filter(
    (s: any) => s.program_id === profile.program && s.level === profile.level
  );

  const handleEndSession = async (id: string) => {
    const { error } = await sessionService.endSession(id);
    if (error) toast.error(error.message);
    else toast.success('Session ended');
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

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Session Management</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage attendance sessions</p>
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
          {filteredSessions.map((session: any, i: number) => (
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
                        session.is_active
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <QrCode className={`w-6 h-6 ${
                          session.is_active
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{session.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{session.courses?.title}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(session.session_date).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {session.start_time} - {session.end_time}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={session.is_active ? 'success' : 'outline'}>
                            {session.is_active ? 'Active' : 'Ended'}
                          </Badge>
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

                    <div className="flex items-center gap-2">
                      {session.is_active ? (
                        <Button variant="outline" size="sm" onClick={() => handleEndSession(session.id)}>
                          <Pause className="w-4 h-4 mr-1" />
                          End
                        </Button>
                      ) : null}
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
          ))}
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
    </motion.div>
  );
}

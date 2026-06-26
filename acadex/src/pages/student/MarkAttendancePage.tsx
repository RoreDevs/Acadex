import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { QrCode, CheckCircle, XCircle, ArrowRight, ScanLine, Clock, BookOpen, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { sessionService } from '@/services/sessionService';
import { attendanceService } from '@/services/attendanceService';
import { settingsService } from '@/services/settingsService';
import { DEFAULT_ATTENDANCE_RADIUS_METERS } from '@/lib/config';
import toast from 'react-hot-toast';

const codeSchema = z.object({
  code: z.string().min(6, 'Code must be at least 6 characters'),
});

type CodeForm = z.infer<typeof codeSchema>;

type LocationStatus = 'idle' | 'checking' | 'denied' | 'outside_radius' | 'unsupported';

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const a = sinDLat * sinDLat + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function MarkAttendancePage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
  });

  const checkLocation = (
    session: any,
    radiusMeters: number
  ): Promise<{ ok: boolean; coords?: { latitude: number; longitude: number } }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocationStatus('unsupported');
        setErrorMessage('Your browser does not support geolocation or location is unavailable.');
        resolve({ ok: false });
        return;
      }
      setLocationStatus('checking');
      setErrorMessage('');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const accuracy = position.coords.accuracy;
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          if (session.latitude == null || session.longitude == null) {
            resolve({ ok: true, coords });
            return;
          }
          const distance = haversineDistance(
            coords.latitude, coords.longitude,
            session.latitude, session.longitude
          );
          console.log('[GeoLocation] Student coords:', { latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6), accuracy: accuracy.toFixed(1) + 'm' });
          console.log('[GeoLocation] Session coords:', { latitude: session.latitude, longitude: session.longitude });
          console.log('[GeoLocation] Distance:', distance.toFixed(1) + 'm / Radius:', radiusMeters + 'm');
          console.log('[GeoLocation] Result:', distance <= radiusMeters ? 'PASS' : 'FAIL');
          if (accuracy > 100) {
            toast('Your device location accuracy is low (' + accuracy.toFixed(0) + 'm). For better results, enable precise location, move closer to a window, or retry.', { duration: 8000 });
          }
          if (distance <= radiusMeters) {
            resolve({ ok: true, coords });
          } else {
            setLocationStatus('outside_radius');
            setErrorMessage('You must be within the classroom area to mark attendance.');
            resolve({ ok: false });
          }
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setLocationStatus('denied');
            setErrorMessage('Grant Location Access before you can sign Attendance');
          } else {
            setLocationStatus('unsupported');
            setErrorMessage('Unable to determine your location. Please try again.');
          }
          resolve({ ok: false });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });
  };

  const onSubmit = async (data: CodeForm) => {
    if (!profile) return;
    setLoading(true);
    setSuccess(false);
    setSessionInfo(null);
    setLocationStatus('idle');
    setErrorMessage('');

    try {
      const session = await sessionService.getSessionByCode(data.code.toUpperCase());

      if (!session) {
        toast.error('Session not found. Please check your code.');
        setLoading(false);
        return;
      }

      if (!session.is_active) {
        toast.error('Session has ended.');
        setLoading(false);
        return;
      }

      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (session.session_date < today) {
        toast.error('Session date has passed.');
        setLoading(false);
        return;
      }

      const [y, m, d] = session.session_date.split('-').map(Number);
      const [hh, mm, ss = '0'] = session.end_time.split(':');
      const sessionEnd = new Date(y, m - 1, d, +hh, +mm, +ss);
      if (now > sessionEnd) {
        toast.error('Session has ended.');
        setLoading(false);
        return;
      }

      const alreadyAttended = await attendanceService.checkAttendance(session.id, profile.id);
      if (alreadyAttended) {
        toast.error('You have already marked attendance for this session.');
        setLoading(false);
        return;
      }

      setSessionInfo(session);

      const radiusSetting = await settingsService.getSetting('attendance_radius_meters');
      const radius = radiusSetting ? Number(radiusSetting) : DEFAULT_ATTENDANCE_RADIUS_METERS;
      setLoading(false);
      const { ok, coords } = await checkLocation(session, radius);
      if (!ok || !coords) {
        return;
      }
      setLoading(true);
      const { result, error } = await attendanceService.verifyAndMarkAttendance(
        profile.id,
        session.id,
        coords,
      );
      if (error) {
        toast.error(error.message);
        setSessionInfo(null);
        setLocationStatus('idle');
        setLoading(false);
        return;
      }
      if (!result?.success) {
        if (result?.error === 'DUPLICATE') {
          toast.error(result.message || 'You have already marked attendance for this session.');
          setSessionInfo(null);
          setLocationStatus('idle');
        } else if (result?.error === 'OUTSIDE_RADIUS') {
          setLocationStatus('outside_radius');
          setErrorMessage('You must be within the classroom area to mark attendance.');
          toast.error(result.message);
        } else {
          toast.error(result.message || 'Failed to mark attendance.');
        }
        setLoading(false);
        return;
      }
      setSuccess(true);
      toast.success('Attendance marked successfully!');
      reset();
      setLoading(false);
    } catch (err) {
      toast.error('Failed to process attendance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setSuccess(false);
    setSessionInfo(null);
    setLocationStatus('idle');
    setErrorMessage('');
    reset();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mark Attendance</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Enter the session code provided by your lecturer</p>
      </div>

      <Card>
        <CardContent className="p-8">
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
              <ScanLine className="w-10 h-10 text-primary-500" />
            </div>
          </div>

          {success && sessionInfo ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Attendance Confirmed!</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{sessionInfo.title}</p>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <BookOpen className="w-4 h-4" />
                {sessionInfo.courses?.title}
                <Clock className="w-4 h-4 ml-2" />
                {sessionInfo.start_time} - {sessionInfo.end_time}
              </div>
              <Badge variant="success" className="text-sm px-4 py-1">
                Present
              </Badge>
              <Button variant="outline" className="mt-4" onClick={resetAll}>
                Mark Another
              </Button>
            </motion.div>
          ) : locationStatus !== 'idle' && sessionInfo ? (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <BookOpen className="w-4 h-4" />
                  {sessionInfo.courses?.title}
                  <Clock className="w-4 h-4 ml-2" />
                  {sessionInfo.start_time} - {sessionInfo.end_time}
                </div>

                {locationStatus === 'checking' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                    <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Checking your location...</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Please allow location access when prompted.</p>
                    </div>
                  </motion.div>
                )}

                {locationStatus === 'denied' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                    <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                      <XCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-red-600 dark:text-red-400">Location access denied</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{errorMessage}</p>
                    </div>
                  </motion.div>
                )}

                {locationStatus === 'outside_radius' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                    <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                      <XCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-red-600 dark:text-red-400">Outside classroom area</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">You must be within the classroom area to mark attendance.</p>
                    </div>
                  </motion.div>
                )}

                {locationStatus === 'unsupported' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                    <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                      <XCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-red-600 dark:text-red-400">Location not available</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{errorMessage}</p>
                    </div>
                  </motion.div>
                )}
              </div>

              {(locationStatus === 'denied' || locationStatus === 'outside_radius' || locationStatus === 'unsupported') && (
                <div className="space-y-2">
                  <Button variant="outline" className="w-full" onClick={resetAll}>
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="code">Session Code</Label>
                <Input
                  id="code"
                  placeholder="ICT101-AB12"
                  className="text-center text-lg tracking-widest font-mono uppercase"
                  {...register('code')}
                  error={errors.code?.message}
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </div>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 mr-2" />
                    Mark Attendance
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How it works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-500 dark:text-gray-400 space-y-2">
          <p>1. Your lecturer will display a session code during class.</p>
          <p>2. Enter the code exactly as shown (case-insensitive).</p>
          <p>3. If location verification is enabled, allow browser location access when prompted.</p>
          <p>4. You must be inside the classroom to mark attendance.</p>
          <p>5. You'll receive a confirmation once successful.</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

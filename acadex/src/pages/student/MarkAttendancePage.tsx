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

type LocationStatus = 'idle' | 'checking' | 'verified' | 'denied' | 'outside_radius' | 'unsupported';

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
  const [studentCoords, setStudentCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
  });

  const checkLocation = (session: any, radiusMeters: number): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocationStatus('unsupported');
        setErrorMessage('Your browser does not support geolocation or location is unavailable.');
        resolve(false);
        return;
      }
      setLocationStatus('checking');
      setErrorMessage('');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setStudentCoords(coords);
          const distance = haversineDistance(
            coords.latitude, coords.longitude,
            session.latitude, session.longitude
          );
          if (distance <= radiusMeters) {
            setLocationStatus('verified');
            setErrorMessage('');
            resolve(true);
          } else {
            setLocationStatus('outside_radius');
            const distMsg = distance >= 1000
              ? `${(distance / 1000).toFixed(1)} km`
              : `${Math.round(distance)} m`;
            setErrorMessage(`You are ${distMsg} away from the classroom. You must be within ${radiusMeters}m to mark attendance.`);
            resolve(false);
          }
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setLocationStatus('denied');
            setErrorMessage('Please enable location services and grant browser permission to mark attendance.');
          } else {
            setLocationStatus('unsupported');
            setErrorMessage('Unable to determine your location. Please try again.');
          }
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000 },
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
    setStudentCoords(null);

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

      if (session.latitude != null && session.longitude != null) {
        const radiusSetting = await settingsService.getSetting('attendance_radius_meters');
        const radius = radiusSetting ? Number(radiusSetting) : DEFAULT_ATTENDANCE_RADIUS_METERS;
        setLocationStatus('checking');
        setLoading(false);
        const locationOk = await checkLocation(session, radius);
        if (!locationOk) {
          return;
        }
        return;
      }

      const { error } = await attendanceService.markAttendance(profile.id, session.id);
      if (error) {
        toast.error(error.message);
        setSessionInfo(null);
      } else {
        setSuccess(true);
        toast.success('Attendance marked successfully!');
        reset();
      }
    } catch (err) {
      toast.error('Failed to process attendance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const confirmAttendance = async () => {
    if (!profile || !sessionInfo || !studentCoords) return;
    setLoading(true);
    try {
      const { result, error } = await attendanceService.verifyAndMarkAttendance(
        profile.id,
        sessionInfo.id,
        studentCoords,
      );
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      if (!result?.success) {
        const msg = result.message || 'Failed to mark attendance.';
        if (result?.error === 'DUPLICATE') {
          toast.error(msg);
          setLocationStatus('idle');
          setSessionInfo(null);
          setStudentCoords(null);
        } else if (result?.error === 'OUTSIDE_RADIUS') {
          setLocationStatus('outside_radius');
          const dist = result.distance;
          const radius = result.radius;
          const distMsg = dist >= 1000
            ? `${(dist / 1000).toFixed(1)} km`
            : `${Math.round(dist)} m`;
          setErrorMessage(`You are ${distMsg} away from the classroom. You must be within ${radius}m to mark attendance.`);
          toast.error(msg);
        } else {
          toast.error(msg);
        }
        setLoading(false);
        return;
      }
      setSuccess(true);
      toast.success(result.message || 'Attendance marked successfully!');
      reset();
    } catch {
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
    setStudentCoords(null);
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

                {locationStatus === 'verified' && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
                    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                      <MapPin className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-green-600 dark:text-green-400">Location verified.</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">You may mark attendance.</p>
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
                      {errorMessage && (
                        <p className="text-xs text-red-500 mt-2 font-medium">{errorMessage}</p>
                      )}
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

              <div className="space-y-3">
                {locationStatus === 'verified' && (
                  <Button className="w-full" size="lg" onClick={confirmAttendance} disabled={loading}>
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Submitting...
                      </div>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Confirm Attendance
                      </>
                    )}
                  </Button>
                )}
                {locationStatus === 'checking' && (
                  <Button className="w-full" size="lg" disabled>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Checking your location...
                    </div>
                  </Button>
                )}
                {(locationStatus === 'denied' || locationStatus === 'outside_radius' || locationStatus === 'unsupported') && (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={resetAll}
                    >
                      Try Again
                    </Button>
                  </div>
                )}
              </div>
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

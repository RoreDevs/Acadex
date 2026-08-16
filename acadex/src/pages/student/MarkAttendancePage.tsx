import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams } from 'react-router-dom';
import { QrCode, CheckCircle, XCircle, ArrowRight, ScanLine, Clock, BookOpen, MapPin, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { attendanceService } from '@/services/attendanceService';
import toast from 'react-hot-toast';

const codeSchema = z.object({
  code: z.string().min(6, 'Code must be at least 6 characters'),
});

type CodeForm = z.infer<typeof codeSchema>;

type Stage =
  | 'form'
  | 'preview'
  | 'not_open'
  | 'closed'
  | 'cancelled'
  | 'already_marked'
  | 'not_enrolled'
  | 'not_found'
  | 'outside_radius'
  | 'marking'
  | 'success';

type LocationRequest =
  | { ok: true; coords: { latitude: number; longitude: number } }
  | { ok: false; code: 'denied' | 'unsupported' };

function requestPosition(): Promise<LocationRequest> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ok: false, code: 'unsupported' });
      return;
    }
    const attempt = (highAccuracy: boolean) => {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            ok: true,
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
          }),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) resolve({ ok: false, code: 'denied' });
          else if (err.code === err.TIMEOUT && highAccuracy) attempt(false);
          else resolve({ ok: false, code: 'unsupported' });
        },
        { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 15000 : 20000, maximumAge: 0 }
      );
    };
    attempt(true);
  });
}

export function MarkAttendancePage() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [stage, setStage] = useState<Stage>('form');
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [locationError, setLocationError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [markedStatus, setMarkedStatus] = useState<'present' | 'late'>('present');
  const autoSubmitted = useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
  });

  const handleMarkResult = useCallback((result: any) => {
    if (!result) return;
    if (!result.success) {
      switch (result.error) {
        case 'DUPLICATE':
          setStage('already_marked');
          break;
        case 'SESSION_CLOSED':
          setStage('closed');
          break;
        case 'SESSION_CANCELLED':
          setStage('cancelled');
          break;
        case 'NOT_OPEN':
          setStage('not_open');
          break;
        case 'NOT_ENROLLED':
          setStage('not_enrolled');
          break;
        case 'SESSION_NOT_FOUND':
          setStage('not_found');
          break;
        case 'OUTSIDE_RADIUS':
          setErrorMessage(result.message || 'You must be within the classroom area to mark attendance.');
          setStage('outside_radius');
          break;
        default:
          setErrorMessage(result.message || 'Failed to mark attendance.');
          setStage('preview');
      }
      return;
    }
    setMarkedStatus(result.status === 'late' ? 'late' : 'present');
    setStage('success');
    toast.success('Attendance marked successfully!');
  }, []);

  const loadSession = useCallback(
    async (rawCode: string) => {
      const code = rawCode.toUpperCase();
      setErrorMessage('');
      const { result, error } = await attendanceService.getSessionForMarking(code);
      if (error) {
        toast.error('Failed to check the session. Please try again.');
        setStage('form');
        return;
      }
      if (!result?.success) {
        setStage(result?.error === 'SESSION_NOT_FOUND' ? 'not_found' : 'form');
        return;
      }
      setSessionInfo({ ...result, code });
      if (result.status === 'cancelled') setStage('cancelled');
      else if (result.status === 'closed') setStage('closed');
      else if (result.already_marked) setStage('already_marked');
      else if (!result.enrolled) setStage('not_enrolled');
      else if (result.status === 'scheduled') setStage('not_open');
      else setStage('preview');
    },
    []
  );

  const onSubmit = async (data: CodeForm) => {
    if (!profile) return;
    await loadSession(data.code);
  };

  // Prefill from QR deep-link (/attendance/:code redirects here with ?code=)
  useEffect(() => {
    const code = searchParams.get('code');
    if (code && !autoSubmitted.current) {
      autoSubmitted.current = true;
      setValue('code', code);
      loadSession(code);
    }
  }, [searchParams, setValue, loadSession]);

  // Poll while waiting for a session to open or during preview so the UI
  // flips automatically when the attendance window opens or closes.
  useEffect(() => {
    if (!sessionInfo?.code || (stage !== 'not_open' && stage !== 'preview')) return;
    const timer = setInterval(() => {
      loadSession(sessionInfo.code);
    }, 15000);
    return () => clearInterval(timer);
  }, [sessionInfo?.code, stage, loadSession]);

  const handleMark = async () => {
    if (!sessionInfo) return;
    setStage('marking');
    setLocationError('');
    try {
      let coords: { latitude: number; longitude: number } | null = null;
      if (sessionInfo.session?.has_location) {
        const loc = await requestPosition();
        if (!loc.ok) {
          setLocationError(
            loc.code === 'denied'
              ? 'Grant location access before you can sign attendance.'
              : 'Unable to determine your location. Please check that location services are turned on and try again.'
          );
          return;
        }
        coords = loc.coords;
      }
      const { result, error } = await attendanceService.markAttendanceByCode(sessionInfo.code, coords || { latitude: 0, longitude: 0 });
      if (error) {
        setErrorMessage(error.message);
        setStage('preview');
        return;
      }
      handleMarkResult(result);
    } catch {
      setErrorMessage('Failed to process attendance. Please try again.');
      setStage('preview');
    }
  };

  const resetAll = () => {
    setStage('form');
    setSessionInfo(null);
    setLocationError('');
    setErrorMessage('');
    autoSubmitted.current = false;
    reset();
    if (searchParams.get('code')) {
      window.history.replaceState({}, '', '/mark-attendance');
    }
  };

  const formatTime = (value: string) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (value: string) => {
    const d = new Date(`${value}T00:00:00`);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const renderCenterIcon = (type: 'success' | 'error' | 'info' | 'neutral') => {
    const styles = {
      success: 'bg-green-100 dark:bg-green-900/30',
      error: 'bg-red-100 dark:bg-red-900/30',
      info: 'bg-blue-100 dark:bg-blue-900/30',
      neutral: 'bg-gray-100 dark:bg-gray-700',
    };
    const icon = type === 'success' ? <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
      : type === 'error' ? <XCircle className="w-8 h-8 text-red-500" />
      : type === 'info' ? <Clock className="w-8 h-8 text-blue-500" />
      : <QrCode className="w-8 h-8 text-gray-500" />;
    return (
      <div className={`w-16 h-16 rounded-full ${styles[type]} flex items-center justify-center mx-auto`}>
        {icon}
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mark Attendance</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Enter the session code provided by your lecturer</p>
      </div>

      <Card>
        <CardContent className="p-8">
          {stage === 'form' && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex justify-center mb-8">
                <div className="w-20 h-20 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                  <ScanLine className="w-10 h-10 text-primary-500" />
                </div>
              </div>

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

              <Button type="submit" className="w-full" size="lg">
                <QrCode className="w-4 h-4 mr-2" />
                Verify Code
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          )}

          {stage === 'preview' && sessionInfo && (
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto">
                  <BookOpen className="w-7 h-7 text-primary-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{sessionInfo.course?.code} · {sessionInfo.course?.title}</p>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{sessionInfo.session?.title}</h2>
                </div>
                <Badge variant="success" className="text-xs px-3 py-1">Attendance Open</Badge>
              </div>

              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                <div className="flex items-center gap-2 px-4 py-3 text-gray-600 dark:text-gray-300">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                  {formatDate(sessionInfo.session?.session_date)}
                  <Clock className="w-4 h-4 text-gray-400 ml-4 shrink-0" />
                  {sessionInfo.session?.start_time} - {sessionInfo.session?.end_time}
                </div>
                {sessionInfo.session?.venue && (
                  <div className="flex items-center gap-2 px-4 py-3 text-gray-600 dark:text-gray-300">
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                    {sessionInfo.session.venue}
                  </div>
                )}
                <div className="flex items-center gap-2 px-4 py-3 text-gray-600 dark:text-gray-300">
                  <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                  Closes at {formatTime(sessionInfo.window?.closes_at)}
                </div>
              </div>

              <Button type="button" className="w-full" size="lg" onClick={handleMark}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Attendance
              </Button>
            </div>
          )}

          {stage === 'marking' && (
            <div className="text-center space-y-4">
              {renderCenterIcon('info')}
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {locationError ? 'Location not available' : 'Checking your location...'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {locationError || 'Please allow location access when prompted.'}
                </p>
              </div>
              {locationError && (
                <Button variant="outline" className="w-full" onClick={() => setStage('preview')}>
                  Try Again
                </Button>
              )}
            </div>
          )}

          {stage === 'success' && sessionInfo && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              {renderCenterIcon('success')}
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Attendance Confirmed!</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{sessionInfo.session?.title}</p>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <BookOpen className="w-4 h-4" />
                {sessionInfo.course?.title}
                <Clock className="w-4 h-4 ml-2" />
                {sessionInfo.session?.start_time} - {sessionInfo.session?.end_time}
              </div>
              <Badge variant={markedStatus === 'late' ? 'warning' : 'success'} className="text-sm px-4 py-1">
                {markedStatus === 'late' ? 'Late' : 'Present'}
              </Badge>
              <Button variant="outline" className="mt-4" onClick={resetAll}>
                Mark Another
              </Button>
            </motion.div>
          )}

          {stage === 'not_open' && (
            <div className="text-center space-y-4">
              {renderCenterIcon('info')}
              <div>
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">Attendance not open yet</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {sessionInfo?.session?.title} · opens at {formatTime(sessionInfo?.window?.opens_at)}.
                  <br />
                  This page will update automatically.
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={resetAll}>
                Enter Another Code
              </Button>
            </div>
          )}

          {stage === 'closed' && (
            <div className="text-center space-y-4">
              {renderCenterIcon('neutral')}
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Attendance closed</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Attendance for this session has closed.</p>
              </div>
              <Button variant="outline" className="w-full" onClick={resetAll}>
                Enter Another Code
              </Button>
            </div>
          )}

          {stage === 'cancelled' && (
            <div className="text-center space-y-4">
              {renderCenterIcon('neutral')}
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Session cancelled</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">This session was cancelled by your lecturer.</p>
              </div>
              <Button variant="outline" className="w-full" onClick={resetAll}>
                Enter Another Code
              </Button>
            </div>
          )}

          {stage === 'already_marked' && (
            <div className="text-center space-y-4">
              {renderCenterIcon('success')}
              <div>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">Already marked</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  You have already marked attendance for {sessionInfo?.session?.title}.
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={resetAll}>
                Enter Another Code
              </Button>
            </div>
          )}

          {stage === 'not_enrolled' && (
            <div className="text-center space-y-4">
              {renderCenterIcon('error')}
              <div>
                <p className="text-lg font-semibold text-red-600 dark:text-red-400">Not enrolled</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  You are not enrolled in {sessionInfo?.course?.title}. Contact your course representative if this is a mistake.
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={resetAll}>
                Enter Another Code
              </Button>
            </div>
          )}

          {stage === 'outside_radius' && (
            <div className="text-center space-y-4">
              {renderCenterIcon('error')}
              <div>
                <p className="text-lg font-semibold text-red-600 dark:text-red-400">Outside classroom area</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{errorMessage}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setStage('preview')}>
                Try Again
              </Button>
            </div>
          )}

          {stage === 'not_found' && (
            <div className="text-center space-y-4">
              {renderCenterIcon('error')}
              <div>
                <p className="text-lg font-semibold text-red-600 dark:text-red-400">Session not found</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Please check your code and try again.</p>
              </div>
              <Button variant="outline" className="w-full" onClick={resetAll}>
                Enter Another Code
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How it works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-500 dark:text-gray-400 space-y-2">
          <p>1. Your lecturer will display a session code (or QR code) during class.</p>
          <p>2. Enter the code exactly as shown (case-insensitive) or scan the QR.</p>
          <p>3. Attendance is only accepted while the session is open and you are in the classroom.</p>
          <p>4. Marking late records you as <span className="font-medium text-amber-600 dark:text-amber-400">Late</span>.</p>
          <p>5. You cannot mark twice — the server blocks duplicates.</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

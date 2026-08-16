import { Navigate, useParams } from 'react-router-dom';

export function AttendanceLinkPage() {
  const { code } = useParams();
  return <Navigate to={`/mark-attendance?code=${encodeURIComponent(code || '')}`} replace />;
}

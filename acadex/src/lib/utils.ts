import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Convert technical failures (Supabase/Postgres/RPC/network) into
// human-readable messages. Curated server messages pass through untouched.
export function friendlyErrorMessage(err: unknown, fallback: string): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : typeof err === 'string'
          ? err
          : '';
  const msg = raw.trim();
  if (!msg) return fallback;

  if (code === '23505' || /duplicate key|unique constraint|already exists/i.test(msg)) {
    return 'This record already exists. Please check for duplicates and try again.';
  }
  if (code === '23503' || /foreign key|violates .* constraint/i.test(msg)) {
    return 'This item cannot be removed because other records depend on it.';
  }
  if (
    code === '42501' ||
    code.startsWith('PGRST') ||
    /row-level security|permission denied|not permitted|jwt|token (expired|invalid)/i.test(msg)
  ) {
    return 'You do not have permission to perform this action.';
  }
  if (msg === 'FORBIDDEN') {
    return 'You do not have permission to perform this action.';
  }
  if (msg === 'NOT_FOUND') {
    return 'The requested item was not found. It may have been removed.';
  }
  if (msg === 'VALIDATION') {
    return 'Please check the entered details and try again.';
  }
  if (/failed to fetch|networkerror|network request failed|timeout|timed out|offline/i.test(msg)) {
    return 'Network error. Please check your connection and try again.';
  }
  if (/function .* does not exist|relation .* does not exist|column .* does not exist/i.test(msg)) {
    return 'Something went wrong on our end. Please try again or contact your administrator.';
  }
  if (msg.length > 160 || /[[{].*(constraint|supabase|postgres|stack)/i.test(msg)) {
    return fallback;
  }
  return msg;
}

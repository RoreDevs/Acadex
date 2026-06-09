import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { router } from '@/routes';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                borderRadius: '12px',
                background: '#fff',
                color: '#1e293b',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
              },
              success: {
                iconTheme: { primary: '#22c55e', secondary: '#fff' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#fff' },
              },
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

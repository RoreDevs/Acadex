import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GraduationCap, Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
});

type Form = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
      toast.success('Password reset link sent to your email');
    }
  };

  return (
    <div className="w-full max-w-md">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <div className="w-16 h-16 rounded-2xl bg-primary-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/25">
          <GraduationCap className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Reset Password</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Enter your email to receive reset instructions</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-card p-8"
      >
        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Check your email</h2>
            <p className="text-gray-500 dark:text-gray-400">
              We've sent a password reset link to your email address.
            </p>
            <Link to="/login">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@university.edu"
                {...register('email')}
                error={errors.email?.message}
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              Remember your password?{' '}
              <Link to="/login" className="text-primary-500 hover:text-primary-600 font-medium">
                Sign In
              </Link>
            </p>
          </form>
        )}
      </motion.div>
    </div>
  );
}

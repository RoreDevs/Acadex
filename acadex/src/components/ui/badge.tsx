import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
        success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
        outline: 'border border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

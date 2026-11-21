import { cn } from '../../lib/utils.js'

const variants = {
  default: 'bg-accent-strong text-white hover:bg-[#065f46] disabled:bg-input disabled:text-muted-foreground',
  secondary: 'border border-input bg-card text-foreground hover:bg-muted',
  ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  destructive: 'bg-destructive text-white hover:bg-[#b91c1c]',
  'destructive-ghost': 'text-destructive hover:bg-destructive-soft',
}

const sizes = {
  sm: 'h-8 gap-1.5 px-2.5 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-5 text-base',
  icon: 'size-10',
  'icon-sm': 'size-8',
}

/** shadcn-style button: variant + size, extra classes merged last. */
export function Button({ variant = 'default', size = 'md', className, type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}

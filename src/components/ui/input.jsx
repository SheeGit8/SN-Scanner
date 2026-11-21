import { cn } from '../../lib/utils.js'

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base text-foreground transition-colors placeholder:text-subtle-foreground focus-visible:border-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 sm:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export function Label({ className, ...props }) {
  return <label className={cn('text-sm font-medium text-muted-foreground', className)} {...props} />
}

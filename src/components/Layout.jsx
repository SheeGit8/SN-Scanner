import { cn } from '../lib/utils.js'

/** Page title row: h1, description and actions. `children` renders above the title (e.g. a Back link). */
export function PageHeader({ title, description, actions, children }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid min-w-0 gap-1">
        {children}
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const statTones = {
  default: 'text-muted-foreground',
  warning: 'border-warning-border bg-warning-bg text-warning',
  danger: 'border-danger-border bg-danger-bg text-danger',
}

/** A number with a label. The icon tile changes tone only when the value needs attention. */
export function StatCard({ label, value, hint, icon: Icon, tone = 'default' }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn('grid size-8 place-items-center rounded-md border', statTones[tone])} aria-hidden="true">
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-pretty text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Dashed box with an icon tile, a title, a description and up to 2 actions. */
export function EmptyState({ icon: Icon, title, description, action, as: Tag = 'p', className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center',
        className,
      )}
    >
      {Icon && (
        <span className="grid size-10 place-items-center rounded-lg border bg-card text-muted-foreground" aria-hidden="true">
          <Icon className="size-5" />
        </span>
      )}
      <div className="grid gap-1">
        <Tag className="font-medium">{title}</Tag>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

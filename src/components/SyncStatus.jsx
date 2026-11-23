import { CloudAlert, CloudCheck, CloudOff, HardDrive, LoaderCircle, RefreshCw } from 'lucide-react'
import { Button, Skeleton } from './ui.jsx'
import { EmptyState } from './Layout.jsx'
import { stock } from '../stock.js'
import { cn } from '../lib/utils.js'

const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`

/** What to tell people about the sync, from the stock snapshot. (Logged out shows the login screen instead.) */
function describe({ mode, state, pending, loaded, error }) {
  if (mode === 'local') {
    return { icon: HardDrive, label: 'Saved in this browser', detail: 'This copy of the app isn’t connected to the Google Sheet.' }
  }
  if (state === 'offline') {
    return {
      icon: CloudOff,
      tone: 'warn',
      label: pending ? `Offline · ${pending} waiting` : 'Offline',
      detail: 'Changes are kept on this device and sent when you’re back online.',
      retry: true,
    }
  }
  if (state === 'error') {
    return {
      icon: CloudAlert,
      tone: 'danger',
      label: pending ? `Not synced · ${pending} waiting` : 'Can’t reach the sheet',
      detail: error || 'The Google Sheet didn’t answer. It will try again shortly.',
      retry: true,
    }
  }
  if (pending) return { icon: LoaderCircle, spin: true, label: `Saving ${plural(pending, 'change')}…`, detail: 'Sending to the Google Sheet.' }
  if (!loaded) return { icon: LoaderCircle, spin: true, label: 'Loading…', detail: 'Loading the stock list from the Google Sheet.' }
  return { icon: CloudCheck, tone: 'ok', label: 'Synced with the sheet', detail: 'Everyone sees the same stock list. Changes show up within a minute.' }
}

// Icon colours on the dark sidebar (3 : 1 or better against it).
const toneIcon = { ok: 'text-emerald-400', warn: 'text-amber-400', danger: 'text-red-400' }

const sidebarFocus = 'outline-none focus-visible:ring-[3px] focus-visible:ring-white/60'

/** One line in the sidebar footer. When something went wrong, tapping it tries again. */
export function SyncStatus({ snap, className }) {
  const d = describe(snap)
  const Icon = d.icon
  const content = (
    <>
      <Icon className={cn('size-3.5 shrink-0', d.spin && 'animate-spin motion-reduce:animate-none', toneIcon[d.tone])} aria-hidden="true" />
      <span className="truncate">{d.label}</span>
    </>
  )
  const base = cn('flex min-w-0 flex-1 items-center gap-2 text-xs text-sidebar-muted', className)

  if (!d.retry) {
    return (
      <p className={base} title={d.detail}>
        {content}
      </p>
    )
  }
  return (
    <button
      type="button"
      onClick={() => stock.sync()}
      title={d.detail}
      aria-label={`${d.label}. ${d.detail} Try again`}
      className={cn(base, '-mx-1 h-9 rounded-lg px-1 text-left text-sidebar-foreground hover:bg-sidebar-accent pointer-coarse:h-11', sidebarFocus)}
    >
      {content}
      <RefreshCw className="ml-auto size-3.5 shrink-0" aria-hidden="true" />
    </button>
  )
}

/** Phones: an icon in the top bar, shown only while something is waiting or wrong. */
export function SyncIndicator({ snap, className }) {
  const d = describe(snap)
  if (snap.mode === 'local' || (!d.retry && !d.spin)) return null
  const Icon = d.icon
  return (
    <button
      type="button"
      onClick={() => stock.sync()}
      aria-label={`${d.label}. ${d.detail}`}
      title={d.label}
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-lg text-sidebar-muted transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground pointer-coarse:size-11',
        sidebarFocus,
        className,
      )}
    >
      <Icon className={cn('size-[18px]', d.spin && 'animate-spin motion-reduce:animate-none', toneIcon[d.tone])} aria-hidden="true" />
    </button>
  )
}

/** Shown in place of a list screen until the sheet's list has been loaded once after logging in. */
export function FirstLoad({ snap }) {
  if (snap.state === 'offline' || snap.state === 'error') {
    const offline = snap.state === 'offline'
    return (
      <EmptyState
        icon={offline ? CloudOff : CloudAlert}
        as="h1"
        title={offline ? 'You’re offline' : 'Can’t load the stock list'}
        description={
          offline
            ? 'The stock list loads from the Google Sheet once you’re back online. You can still scan; scans are kept on this device until then.'
            : snap.error
        }
        action={
          <Button variant="outline" onClick={() => stock.sync()}>
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    )
  }
  return (
    <div className="grid gap-4" role="status" aria-label="Loading the stock list from the Google Sheet">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}

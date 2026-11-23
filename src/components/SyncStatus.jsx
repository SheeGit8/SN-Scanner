import { useState } from 'react'
import { CloudAlert, CloudCheck, CloudOff, HardDrive, LoaderCircle, LockKeyhole, RefreshCw } from 'lucide-react'
import { Button, Dialog, Field, Input, Skeleton } from './ui.jsx'
import { EmptyState } from './Layout.jsx'
import { stock } from '../stock.js'
import { cn } from '../lib/utils.js'

const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`

/** What to tell people about the sync, from the stock snapshot. */
function describe({ mode, state, pending, loaded, error }) {
  if (mode === 'local') {
    return { icon: HardDrive, label: 'Saved in this browser', detail: 'This copy of the app isn’t connected to the Google Sheet.' }
  }
  if (state === 'locked') {
    return {
      icon: LockKeyhole,
      tone: 'warn',
      label: 'Locked',
      detail: pending ? `${plural(pending, 'change')} waiting. Enter the app password to sync.` : 'Enter the app password to sync.',
      action: 'unlock',
    }
  }
  if (state === 'offline') {
    return {
      icon: CloudOff,
      tone: 'warn',
      label: pending ? `Offline · ${pending} waiting` : 'Offline',
      detail: 'Changes are kept on this device and sent when you’re back online.',
      action: 'retry',
    }
  }
  if (state === 'error') {
    return {
      icon: CloudAlert,
      tone: 'danger',
      label: pending ? `Not synced · ${pending} waiting` : 'Can’t reach the sheet',
      detail: error || 'The Google Sheet didn’t answer. It will try again shortly.',
      action: 'retry',
    }
  }
  if (pending) return { icon: LoaderCircle, spin: true, label: `Saving ${plural(pending, 'change')}…`, detail: 'Sending to the Google Sheet.' }
  if (!loaded) return { icon: LoaderCircle, spin: true, label: 'Loading…', detail: 'Loading the stock list from the Google Sheet.' }
  return { icon: CloudCheck, tone: 'ok', label: 'Synced with the sheet', detail: 'Everyone sees the same stock list. Changes show up within a minute.' }
}

// Icon colours on the dark sidebar (3 : 1 or better against it).
const toneIcon = { ok: 'text-emerald-400', warn: 'text-amber-400', danger: 'text-red-400' }

const sidebarFocus = 'outline-none focus-visible:ring-[3px] focus-visible:ring-white/60'

/** One line in the sidebar footer. Tapping it retries, or asks for the password. */
export function SyncStatus({ snap, onUnlock, className }) {
  const d = describe(snap)
  const Icon = d.icon
  const content = (
    <>
      <Icon className={cn('size-3.5 shrink-0', d.spin && 'animate-spin motion-reduce:animate-none', toneIcon[d.tone])} aria-hidden="true" />
      <span className="truncate">{d.label}</span>
    </>
  )
  const base = cn('flex min-w-0 flex-1 items-center gap-2 text-xs text-sidebar-muted', className)

  if (!d.action) {
    return (
      <p className={base} title={d.detail}>
        {content}
      </p>
    )
  }
  return (
    <button
      type="button"
      onClick={() => (d.action === 'unlock' ? onUnlock() : stock.sync())}
      title={d.detail}
      aria-label={`${d.label}. ${d.detail} ${d.action === 'unlock' ? 'Enter password' : 'Try again'}`}
      className={cn(base, '-mx-1 h-9 rounded-lg px-1 text-left text-sidebar-foreground hover:bg-sidebar-accent pointer-coarse:h-11', sidebarFocus)}
    >
      {content}
      <span className="ml-auto shrink-0 font-medium underline-offset-2">{d.action === 'unlock' ? 'Unlock' : 'Retry'}</span>
    </button>
  )
}

/** Phones: an icon in the top bar, shown only while something is waiting or wrong. */
export function SyncIndicator({ snap, onUnlock, className }) {
  const d = describe(snap)
  if (snap.mode === 'local' || (!d.action && !d.spin)) return null
  const Icon = d.icon
  return (
    <button
      type="button"
      onClick={() => (d.action === 'unlock' ? onUnlock() : stock.sync())}
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

/** Shown in place of a list screen until the sheet's list has been loaded once on this device. */
export function FirstLoad({ snap, onUnlock }) {
  if (snap.state === 'locked') {
    return (
      <EmptyState
        icon={LockKeyhole}
        as="h1"
        title="Enter the app password"
        description="The stock list is kept in the team’s Google Sheet. Enter the app password once on this device to open it. You can still scan; scans wait here until then."
        action={<Button onClick={onUnlock}>Enter password</Button>}
      />
    )
  }
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

/** Asks for the app password (APP_PASSWORD in Vercel) and checks it with the sheet. */
export function UnlockDialog({ open, onClose, pending }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const close = () => {
    setError('')
    setPassword('')
    onClose()
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!password) return setError('Enter the password.')
    setBusy(true)
    setError('')
    try {
      await stock.unlock(password)
      setPassword('')
      onClose()
    } catch (err) {
      setError(err.auth ? 'That password isn’t right. Check it with whoever set up the app.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      onSubmit={submit}
      busy={busy}
      title="Connect to the stock sheet"
      description="The stock list is kept in the team’s Google Sheet. Enter the app password once and this device remembers it."
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={busy}>
            Not now
          </Button>
          <Button type="submit" loading={busy}>
            Unlock
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field
          id="app-password"
          label="App password"
          error={error}
          hint={pending ? `${plural(pending, 'change')} on this device will be sent once you’re in.` : undefined}
        >
          {(p) => (
            <Input
              {...p}
              data-autofocus
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError('')
              }}
            />
          )}
        </Field>
      </div>
    </Dialog>
  )
}

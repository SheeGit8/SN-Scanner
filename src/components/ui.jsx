/* Small shadcn/ui-style primitives, written by hand (no Radix). See DESIGN.md section 5.1. */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react'

import { cn, focusRing } from '../lib/utils.js'
import { ToastCtx } from '../lib/toast.js'

/* ---------- Button ---------- */

const buttonVariants = {
  default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
  outline:
    'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-white/5 dark:hover:bg-white/10',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
  destructive: 'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
  link: 'text-foreground underline-offset-4 hover:underline',
}

// Touch screens get 40 to 44 px targets; mouse density stays the same.
const buttonSizes = {
  sm: 'h-8 gap-1.5 rounded-md px-3 text-[13px] pointer-coarse:h-10',
  default: 'h-9 gap-2 rounded-md px-4 text-sm pointer-coarse:h-11',
  lg: 'h-10 gap-2 rounded-md px-6 text-sm pointer-coarse:h-12',
  icon: 'size-9 rounded-md pointer-coarse:size-11',
  'icon-sm': 'size-8 rounded-md pointer-coarse:size-10',
}

export function Button({ variant = 'default', size = 'default', loading = false, className, children, disabled, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-[color,background-color,box-shadow] duration-150 select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        focusRing,
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

/* ---------- Card ---------- */

export function Card({ as: Tag = 'div', className, ...props }) {
  return <Tag className={cn('rounded-xl border bg-card text-card-foreground shadow-xs', className)} {...props} />
}
export function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1.5 px-5 pt-5', className)} {...props} />
}
export function CardTitle({ as: Tag = 'h2', className, ...props }) {
  return <Tag className={cn('text-base leading-none font-semibold tracking-tight', className)} {...props} />
}
export function CardDescription({ className, ...props }) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}
export function CardContent({ className, ...props }) {
  return <div className={cn('px-5 pb-5', className)} {...props} />
}

/* ---------- Form controls ---------- */

// 16 px text on phones so iOS Safari doesn't zoom when a field is focused.
const inputBase =
  'w-full min-w-0 rounded-md border border-input bg-background px-3 text-base shadow-xs transition-[color,box-shadow] placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm dark:bg-white/5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40'

export function Input({ className, ...props }) {
  return <input className={cn(inputBase, 'h-9 py-1 pointer-coarse:h-11', focusRing, className)} {...props} />
}

/**
 * A native <select> styled like Input. Phones open their own picker, which beats a custom list
 * for one-handed use. `className` goes on the wrapper, so it sizes the whole control.
 * `leading` is an icon shown inside it, before the picked option.
 */
export function Select({ className, selectClassName, leading, children, ...props }) {
  return (
    <div className={cn('relative min-w-0', className)}>
      {leading && (
        <span className="pointer-events-none absolute top-1/2 left-3 flex -translate-y-1/2 [&_svg]:size-4" aria-hidden="true">
          {leading}
        </span>
      )}
      <select
        className={cn(
          inputBase,
          'h-9 cursor-pointer appearance-none truncate py-1 pr-9 pointer-coarse:h-11 [&_optgroup]:bg-popover [&_optgroup]:text-muted-foreground [&_option]:bg-popover [&_option]:text-foreground',
          leading && 'pl-9',
          focusRing,
          selectClassName,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>
  )
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn(inputBase, 'min-h-16 py-2', focusRing, className)} {...props} />
}

export function Label({ className, ...props }) {
  return <label className={cn('text-[13px] leading-none font-medium select-none', className)} {...props} />
}

/**
 * Label + control + hint or error, wired with ids for screen readers.
 * `children` is a render function that receives the props to spread on the control.
 */
export function Field({ id: idProp, label, hint, error, required, optional, className, children }) {
  const autoId = useId()
  const id = idProp || autoId
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  return (
    <div className={cn('grid content-start gap-2', className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="text-destructive" aria-hidden="true">
            {' '}
            *
          </span>
        )}
        {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </Label>
      {children({
        id,
        'aria-describedby': [hintId, errId].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error ? true : undefined,
        required,
      })}
      {error ? (
        <p id={errId} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/* ---------- Badge, Alert, Kbd ---------- */

const badgeVariants = {
  default: 'border-transparent bg-primary text-primary-foreground',
  secondary: 'border-transparent bg-secondary text-secondary-foreground',
  outline: 'text-foreground',
  success: 'border-success-border bg-success-bg text-success',
  warning: 'border-warning-border bg-warning-bg text-warning',
  danger: 'border-danger-border bg-danger-bg text-danger',
  info: 'border-info-border bg-info-bg text-info',
  muted: 'border-transparent bg-muted text-muted-foreground',
}

/** Status badges always include words, not just a color. */
export function Badge({ variant = 'outline', className, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0',
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  )
}

const alertVariants = {
  info: { className: 'border-info-border bg-info-bg text-info', icon: Info },
  warning: { className: 'border-warning-border bg-warning-bg text-warning', icon: TriangleAlert },
  danger: { className: 'border-danger-border bg-danger-bg text-danger', icon: CircleAlert },
  success: { className: 'border-success-border bg-success-bg text-success', icon: CircleCheck },
}

/** Inline notice: tinted box, icon and text. Pass `action` for a button on the right. */
export function Alert({ variant = 'info', title, children, action, className, ...props }) {
  const { className: tone, icon: Icon } = alertVariants[variant]
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm', tone, className)} {...props}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="grid flex-1 gap-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  )
}

export function Kbd({ className, ...props }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-mono text-xs font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}

/* ---------- Dialog ---------- */

/**
 * Modal built on <dialog>.showModal(): the browser gives the focus trap, Esc, the backdrop and
 * returning focus to the opener. `onClose` runs for Esc, the X button and backdrop clicks;
 * while `busy` they are ignored. `side="right"` turns it into a full-height side panel.
 * Pass `onSubmit` to make the body and footer one <form>. Put `data-autofocus` on the
 * control that should get focus first (otherwise the browser picks the first focusable one).
 */
export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
  onSubmit,
  side = 'center',
  className,
  bodyClassName,
  busy = false,
}) {
  const ref = useRef(null)
  const downOnBackdrop = useRef(false)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      d.querySelector('[data-autofocus]')?.focus()
    }
    if (!open && d.open) d.close()
  }, [open])

  const requestClose = () => {
    if (!busy) onClose()
  }

  const Body = onSubmit ? 'form' : 'div'
  const panel = side === 'right'

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        if (e.target !== ref.current) return // a nested dialog's Esc
        e.preventDefault()
        requestClose()
      }}
      // Close on a backdrop click, but not when a drag (e.g. selecting text) ends outside.
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === ref.current
      }}
      onClick={(e) => {
        if (e.target === ref.current && downOnBackdrop.current) requestClose()
      }}
      className={cn(
        'border bg-background p-0 text-foreground shadow-lg',
        panel
          ? 'sheet-right m-0 ml-auto h-dvh max-h-none w-full max-w-md border-y-0 border-r-0'
          : 'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-xl',
        className,
      )}
    >
      {open && (
        <Body
          onSubmit={onSubmit}
          noValidate={onSubmit ? true : undefined}
          className={cn('flex flex-col', panel ? 'h-full' : 'max-h-[calc(100dvh-2rem)]')}
        >
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div className="grid min-w-0 gap-1">
              {eyebrow && <p className="text-xs font-medium text-muted-foreground">{eyebrow}</p>}
              <h2 id={titleId} className="truncate text-base font-semibold tracking-tight">
                {title}
              </h2>
              {description && (
                <p id={descId} className="text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={requestClose} disabled={busy} className="-mt-1 -mr-2">
              <X />
            </Button>
          </div>
          {children && <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>{children}</div>}
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t bg-muted/40 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end">
              {footer}
            </div>
          )}
        </Body>
      )}
    </dialog>
  )
}

/**
 * Confirm a risky action. The safe choice is outline and gets focus first; the destructive
 * choice is red and sits on the right.
 */
export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel, children }) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  )
}

/* ---------- Toasts ---------- */

const toastIcons = {
  success: <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />,
  error: <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />,
  info: <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />,
}

/** Bottom-center on phones, bottom-right on desktop. Errors stay until dismissed. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const push = useCallback(
    (message, { type = 'success', duration } = {}) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((t) => [...t.slice(-3), { id, message, type }])
      const ms = duration ?? (type === 'error' ? null : 4000)
      if (ms) setTimeout(() => dismiss(id), ms)
    },
    [dismiss],
  )

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-popover px-4 py-3 text-sm shadow-lg motion-safe:animate-[toast-in_160ms_cubic-bezier(0.16,1,0.3,1)]"
          >
            {toastIcons[t.type] ?? toastIcons.success}
            <p className="min-w-0 flex-1 break-words">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className={cn('-m-1 rounded p-1 text-muted-foreground hover:text-foreground', focusRing)}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

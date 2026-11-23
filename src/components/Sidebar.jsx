import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, History, LayoutDashboard, LogOut, Menu, Moon, ScanText, Search, Sheet, Sun, UserRound, X } from 'lucide-react'
import logoUrl from '../assets/logo-mark.png'
import { SyncIndicator, SyncStatus } from './SyncStatus.jsx'
import { itemName, searchValues } from '../storage.js'
import { cn, matchesQuery } from '../lib/utils.js'

const NAV = [
  { view: 'home', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'scanner', label: 'Scanner', icon: ScanText },
  { view: 'photo', label: 'Photo', icon: Camera },
  { view: 'history', label: 'History', icon: History },
  { view: 'sheet', label: 'Spreadsheet', icon: Sheet },
]

// White-tinted focus ring on the dark sidebar (7 : 1 against it).
const sidebarFocus = 'outline-none focus-visible:ring-[3px] focus-visible:ring-white/60'

const iconBtn = cn(
  'grid size-9 place-items-center rounded-lg text-sidebar-muted transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:pointer-events-none disabled:opacity-40 pointer-coarse:size-11',
  sidebarFocus,
)

/** The Sheehan mark on a white tile (the logo has black in it, so it needs a light background). */
function Logo({ className }) {
  return (
    <span className={cn('grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-sm', className)} aria-hidden="true">
      <img src={logoUrl} alt="" className="size-full object-contain" />
    </span>
  )
}

function Brand({ onClick }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex min-w-0 items-center gap-3 rounded-lg text-left', sidebarFocus)}>
      <Logo className="size-10" />
      <span className="grid min-w-0 leading-tight">
        <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">Sheehan</span>
        <span className="truncate text-xs text-sidebar-muted">IT Stock Scanner</span>
      </span>
    </button>
  )
}

/** Scanned items with a filter, so any item is one click away from any page. */
function ItemList({ scans, selectedId, onOpenItem }) {
  const [query, setQuery] = useState('')
  const items = useMemo(
    () => scans.filter((s) => matchesQuery(searchValues(s), query)),
    [scans, query],
  )

  return (
    <section aria-labelledby="items-heading" className="mt-6 flex min-h-0 flex-1 flex-col border-t border-white/10 pt-5">
      <div className="flex items-baseline justify-between px-3 pb-2">
        <h2 id="items-heading" className="text-xs font-medium tracking-wide text-sidebar-muted uppercase">
          Scanned items
        </h2>
        <span className="font-mono text-xs text-sidebar-muted tabular-nums">
          {query ? `${items.length} of ${scans.length}` : scans.length}
        </span>
      </div>
      <div className="relative mx-1 mb-2">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-sidebar-muted" aria-hidden="true" />
        <label htmlFor="sidebar-search" className="sr-only">
          Filter scanned items
        </label>
        <input
          id="sidebar-search"
          type="search"
          placeholder="Filter items"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          className={cn(
            'h-9 w-full rounded-md border border-sidebar-input bg-white/5 pr-3 pl-9 text-base text-sidebar-foreground placeholder:text-sidebar-muted sm:text-sm pointer-coarse:h-11',
            sidebarFocus,
          )}
        />
      </div>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {scans.length === 0 ? (
          <p className="px-3 py-4 text-xs text-sidebar-muted">Items you scan appear here with their name and serial number.</p>
        ) : items.length === 0 ? (
          <p className="px-3 py-4 text-xs text-sidebar-muted">No items match “{query}”.</p>
        ) : (
          <ul className="grid gap-px">
            {items.map((s) => {
              const name = itemName(s)
              const active = s.id === selectedId
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onOpenItem(s.id)}
                    aria-current={active ? 'true' : undefined}
                    title={[name, s.serial, s.category, s.user, s.model, s.location].filter(Boolean).join(' · ')}
                    className={cn(
                      'grid w-full gap-0.5 rounded-lg px-3 py-2 text-left transition-colors duration-150',
                      sidebarFocus,
                      active ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent/60',
                    )}
                  >
                    <span className={cn('truncate text-[13px] font-medium text-sidebar-foreground', !name && 'text-sidebar-muted italic')}>
                      {name || 'Unnamed item'}
                    </span>
                    <span className={cn('truncate text-xs text-sidebar-muted', s.serial ? 'font-mono' : 'italic')}>
                      {s.serial || 'No serial number'}
                    </span>
                    {s.user && (
                      <span className="flex min-w-0 items-center gap-1 text-xs text-sidebar-muted">
                        <UserRound className="size-3 shrink-0" aria-hidden="true" />
                        <span className="sr-only">User: </span>
                        <span className="truncate">{s.user}</span>
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

/** Brand, main nav, the item list, and the storage note + theme toggle pinned to the bottom. */
function SidebarBody({ scans, view, selectedId, onNavigate, onOpenItem, dark, onToggleTheme, onClose, sync, onLogout }) {
  return (
    <div className="flex h-full flex-col bg-sidebar px-3 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))] text-sidebar-foreground">
      <div className="flex items-center justify-between gap-2 px-2">
        <Brand onClick={() => onNavigate('home')} />
        {onClose && (
          <button type="button" onClick={onClose} className={iconBtn} aria-label="Close menu">
            <X className="size-5" />
          </button>
        )}
      </div>

      <nav aria-label="Main" className="mt-8 grid gap-1">
        {NAV.map(({ view: v, label, icon: Icon }) => {
          const active = view === v
          return (
            <button
              key={v}
              type="button"
              onClick={() => onNavigate(v)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150',
                sidebarFocus,
                active
                  ? 'bg-sidebar-accent text-sidebar-foreground before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-sidebar-brand'
                  : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden="true" />
              <span className="flex-1 text-left">{label}</span>
              {v === 'sheet' && (
                <span className="font-mono text-xs text-sidebar-muted tabular-nums" aria-label={`${scans.length} rows`}>
                  {scans.length}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <ItemList scans={scans} selectedId={selectedId} onOpenItem={onOpenItem} />

      <div className="grid gap-1 border-t border-white/10 px-2 pt-3">
        {/* Logged in: the sync status gets its own row, so "Offline · 3 waiting" isn't cut off. */}
        <div className="flex min-h-9 items-center gap-2">
          <SyncStatus snap={sync} />
          {!onLogout && <ThemeButton dark={dark} onToggle={onToggleTheme} />}
        </div>
        {onLogout && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onLogout}
              className={cn(
                '-mx-1 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-xs font-medium text-sidebar-muted transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground pointer-coarse:h-11',
                sidebarFocus,
              )}
            >
              <LogOut className="size-3.5 shrink-0" aria-hidden="true" />
              Log out
            </button>
            <ThemeButton dark={dark} onToggle={onToggleTheme} />
          </div>
        )}
      </div>
    </div>
  )
}

function ThemeButton({ dark, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={iconBtn}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
    >
      {dark ? <Sun className="size-[18px]" aria-hidden="true" /> : <Moon className="size-[18px]" aria-hidden="true" />}
    </button>
  )
}

/** Fixed 256 px sidebar on screens 768 px and up. */
export function Sidebar(props) {
  return (
    <aside aria-label="Sidebar" className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-sidebar-border md:block">
      <SidebarBody {...props} />
    </aside>
  )
}

/** Phones and small tablets: a top bar whose menu button opens the sidebar as a slide-in drawer. */
export function MobileNav({ open, onOpenChange, onScan, ...props }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  const close = () => onOpenChange(false)

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground md:hidden">
        <button type="button" onClick={() => onOpenChange(true)} className={cn(iconBtn, '-ml-1.5')} aria-label="Open menu" aria-expanded={open}>
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <Logo className="size-8 rounded-lg" />
        <span className="grid min-w-0 flex-1 leading-tight">
          <span className="text-sm font-semibold tracking-tight">Sheehan</span>
          <span className="truncate text-xs text-sidebar-muted">IT Stock Scanner</span>
        </span>
        <SyncIndicator snap={props.sync} />
        {props.view !== 'scanner' && (
          <button
            type="button"
            onClick={onScan}
            className={cn(
              'flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent pointer-coarse:h-11 [&_svg]:size-[18px]',
              sidebarFocus,
            )}
          >
            <ScanText aria-hidden="true" />
            Scan
          </button>
        )}
      </header>

      <dialog
        ref={ref}
        aria-label="Menu"
        className="drawer m-0 h-dvh max-h-none w-72 max-w-[85vw] border-r border-sidebar-border bg-sidebar p-0 md:hidden"
        onClose={close}
        onClick={(e) => e.target === e.currentTarget && close()} // backdrop click
      >
        {open && (
          <SidebarBody
            {...props}
            onClose={close}
            onNavigate={(v) => {
              close()
              props.onNavigate(v)
            }}
            onOpenItem={(id) => {
              close()
              props.onOpenItem(id)
            }}
            onLogout={
              props.onLogout &&
              (() => {
                close()
                props.onLogout()
              })
            }
          />
        )}
      </dialog>
    </>
  )
}

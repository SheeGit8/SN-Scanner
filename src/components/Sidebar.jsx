import { useEffect, useMemo, useState } from 'react'
import { HardDrive, History, LayoutDashboard, ScanText, Search, Sheet, X } from 'lucide-react'
import { Button } from './ui/button.jsx'
import { Input } from './ui/input.jsx'
import { itemName } from '../storage.js'
import { cn, matchesQuery } from '../lib/utils.js'

const NAV = [
  { view: 'home', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'scanner', label: 'Scanner', icon: ScanText },
  { view: 'history', label: 'History', icon: History },
  { view: 'sheet', label: 'Spreadsheet', icon: Sheet },
]

export default function Sidebar({ scans, view, selectedId, open, onClose, onNavigate, onOpenItem }) {
  const [query, setQuery] = useState('')

  const items = useMemo(
    () => scans.filter((s) => matchesQuery([s.serial, itemName(s), s.model, s.color, s.location, s.note], query)),
    [scans, query],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-foreground/40 lg:hidden" aria-hidden="true" onClick={onClose} />
      )}
      <aside
        aria-label="Sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[18.5rem] max-w-[85vw] flex-col border-r border-border bg-card transition-transform duration-200 ease-out',
          'lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:max-w-none lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
          <span className="grid size-9 place-items-center rounded-md bg-accent-strong text-white">
            <ScanText className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate font-semibold">IT Stock Scanner</p>
            <p className="truncate text-xs text-muted-foreground">Serial number inventory</p>
          </div>
          <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Close menu" onClick={onClose}>
            <X />
          </Button>
        </div>

        {/* Primary navigation */}
        <nav aria-label="Main" className="shrink-0 px-3 py-3">
          <ul className="space-y-0.5">
            {NAV.map(({ view: v, label, icon: Icon }) => {
              const active = view === v
              return (
                <li key={v}>
                  <button
                    type="button"
                    onClick={() => onNavigate(v)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150',
                      active
                        ? 'bg-accent-soft text-accent-strong'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                    <span className="flex-1 text-left">{label}</span>
                    {v === 'sheet' && (
                      <span className="font-mono text-xs tabular-nums text-subtle-foreground">{scans.length}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Scanned items list */}
        <section aria-labelledby="items-heading" className="flex min-h-0 flex-1 flex-col border-t border-border">
          <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
            <h2 id="items-heading" className="text-sm font-semibold">
              Scanned items
            </h2>
            <span className="font-mono text-xs tabular-nums text-subtle-foreground">
              {query ? `${items.length}/${scans.length}` : scans.length}
            </span>
          </div>
          <div className="relative px-3 pb-2">
            <Search className="pointer-events-none absolute top-1/2 left-6 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
            <label htmlFor="sidebar-search" className="sr-only">
              Filter scanned items
            </label>
            <Input
              id="sidebar-search"
              type="search"
              placeholder="Filter items"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-9"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {scans.length === 0 ? (
              <p className="px-2 py-6 text-sm text-muted-foreground">
                Items you scan appear here with their name and serial number.
              </p>
            ) : items.length === 0 ? (
              <p className="px-2 py-6 text-sm text-muted-foreground">No items match “{query}”.</p>
            ) : (
              <ul className="space-y-px">
                {items.map((s) => {
                  const name = itemName(s)
                  const detail = [s.model, s.location].filter(Boolean).join(', ')
                  const active = s.id === selectedId
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => onOpenItem(s.id)}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'group flex w-full flex-col gap-0.5 rounded-md border-l-2 px-3 py-2 text-left transition-colors duration-150',
                          active
                            ? 'border-accent bg-accent-soft'
                            : 'border-transparent hover:bg-muted',
                        )}
                      >
                        <span className={cn('truncate text-sm font-medium', !name && 'italic text-subtle-foreground')}>
                          {name || 'Unnamed item'}
                        </span>
                        <span className="truncate font-mono text-xs text-muted-foreground">
                          {s.serial || 'No serial number'}
                        </span>
                        {detail && <span className="truncate text-xs text-subtle-foreground">{detail}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        <footer className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <HardDrive className="size-3.5" aria-hidden="true" />
          Saved in this browser on this device
        </footer>
      </aside>
    </>
  )
}

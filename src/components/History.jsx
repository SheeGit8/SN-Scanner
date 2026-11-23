import { useMemo, useState } from 'react'
import { Download, History as HistoryIcon, ScanText, Search, SearchX, Trash2 } from 'lucide-react'
import { Button, Card, ConfirmDialog, Input } from './ui.jsx'
import { EmptyState, PageHeader } from './Layout.jsx'
import ScanRow from './ScanRow.jsx'
import { downloadCsv, formatDay, itemName, searchValues } from '../storage.js'
import { matchesQuery } from '../lib/utils.js'
import { deletedFrom } from '../lib/api.js'
import { useToast } from '../lib/toast.js'

export default function History({ scans, onDelete, onOpen, onScan }) {
  const [query, setQuery] = useState('')
  const [confirm, setConfirm] = useState(null) // the scan waiting for a delete confirmation
  const toast = useToast()

  const filtered = useMemo(
    () => scans.filter((s) => matchesQuery(searchValues(s), query)),
    [scans, query],
  )

  const groups = useMemo(() => {
    const map = new Map()
    for (const s of filtered) {
      const day = formatDay(s.scannedAt)
      if (!map.has(day)) map.set(day, [])
      map.get(day).push(s)
    }
    return [...map.entries()]
  }, [filtered])

  const isFiltering = query.trim() !== ''
  const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`

  return (
    <div className="grid gap-6">
      <PageHeader
        title="History"
        description="Every scan, newest first. Select an item to see or edit its details."
        actions={
          <>
            <Button variant="outline" onClick={() => downloadCsv(filtered)} disabled={!filtered.length}>
              <Download aria-hidden="true" />
              Export CSV
            </Button>
            <Button onClick={onScan}>
              <ScanText aria-hidden="true" />
              Open scanner
            </Button>
          </>
        }
      />

      {scans.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          as="h2"
          title="No scans yet"
          description="Scanned and typed serial numbers are listed here, grouped by day."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="relative min-w-60 flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="history-search" className="sr-only">
                Search scans
              </label>
              <Input
                id="history-search"
                type="search"
                className="pl-9"
                placeholder="Search serial, name, user, model or location"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground tabular-nums" role="status">
              {isFiltering ? `${filtered.length} of ${plural(scans.length, 'scan')} match` : plural(scans.length, 'scan')}
            </p>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={SearchX}
              as="h2"
              title="No matching scans"
              description="Try a shorter search, or part of the serial number."
              action={
                <Button variant="outline" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            groups.map(([day, items]) => (
              <section key={day} aria-label={day} className="grid gap-2">
                <h2 className="flex items-baseline gap-2 text-sm font-semibold">
                  {day}
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">· {plural(items.length, 'scan')}</span>
                </h2>
                <Card as="ul" className="overflow-hidden">
                  {items.map((s) => (
                    <ScanRow key={s.id} scan={s} onOpen={onOpen}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:bg-danger-bg hover:text-danger"
                        onClick={() => setConfirm(s)}
                        aria-label={`Delete scan ${s.serial || itemName(s) || 'with no serial number'}`}
                        title="Delete scan"
                      >
                        <Trash2 />
                      </Button>
                    </ScanRow>
                  ))}
                </Card>
              </section>
            ))
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        title="Delete this scan?"
        description={
          confirm &&
          `Removes ${[confirm.serial, itemName(confirm)].filter(Boolean).join(' · ') || 'this item'} ${deletedFrom}. This can’t be undone.`
        }
        cancelLabel="Keep scan"
        confirmLabel="Delete scan"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          onDelete(confirm.id)
          toast(`Deleted ${confirm.serial || 'the scan'}.`)
          setConfirm(null)
        }}
      />
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Download, ScanText, Search, Trash2 } from 'lucide-react'
import { Button } from './ui/button.jsx'
import { Input } from './ui/input.jsx'
import PageHeader from './PageHeader.jsx'
import ScanRow from './ScanRow.jsx'
import { downloadCsv, formatDay, itemName } from '../storage.js'
import { matchesQuery } from '../lib/utils.js'

export default function History({ scans, onDelete, onOpen, onScan }) {
  const [query, setQuery] = useState('')
  const [confirmId, setConfirmId] = useState(null)

  const filtered = useMemo(
    () => scans.filter((s) => matchesQuery([s.serial, itemName(s), s.model, s.color, s.location, s.note], query)),
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

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader title="History" description="Every scan, newest first. Select an item to see or edit its details.">
        <Button variant="secondary" onClick={() => downloadCsv(filtered)} disabled={!filtered.length}>
          <Download aria-hidden="true" />
          Export CSV
        </Button>
      </PageHeader>

      {scans.length === 0 ? (
        <section className="rounded-lg border border-dashed border-input bg-card px-6 py-12 text-center">
          <h2 className="text-lg font-semibold">No scans yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Scanned and typed serial numbers are listed here, grouped by day.
          </p>
          <Button className="mt-5" onClick={onScan}>
            <ScanText aria-hidden="true" />
            Open scanner
          </Button>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-60 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
              <label htmlFor="history-search" className="sr-only">
                Search scans
              </label>
              <Input
                id="history-search"
                type="search"
                className="pl-9"
                placeholder="Search serial, name, model or location"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground" role="status">
              {isFiltering
                ? `${filtered.length} of ${scans.length} scans match`
                : `${scans.length} ${scans.length === 1 ? 'scan' : 'scans'}`}
            </p>
          </div>

          {filtered.length === 0 ? (
            <section className="rounded-lg border border-dashed border-input bg-card px-6 py-10 text-center">
              <h2 className="font-semibold">No matching scans</h2>
              <p className="mt-1 text-sm text-muted-foreground">Try a shorter search, or part of the serial number.</p>
              <Button variant="secondary" className="mt-4" onClick={() => setQuery('')}>
                Clear search
              </Button>
            </section>
          ) : (
            groups.map(([day, items]) => (
              <section key={day} aria-label={day}>
                <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
                  {day}
                  <span className="font-mono text-xs font-normal text-subtle-foreground">{items.length}</span>
                </h2>
                <ul className="overflow-hidden rounded-lg border border-border bg-card">
                  {items.map((s) => (
                    <ScanRow key={s.id} scan={s} onOpen={onOpen}>
                      {confirmId === s.id ? (
                        <span className="flex gap-1.5">
                          <Button variant="destructive" size="sm" onClick={() => onDelete(s.id)}>
                            Delete
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => setConfirmId(null)}>
                            Keep
                          </Button>
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="hover:bg-destructive-soft hover:text-destructive"
                          onClick={() => setConfirmId(s.id)}
                          aria-label={`Delete scan ${s.serial}`}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </ScanRow>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </main>
  )
}

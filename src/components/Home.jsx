import { ArrowRight, ScanText, Sheet } from 'lucide-react'
import { Button } from './ui/button.jsx'
import PageHeader from './PageHeader.jsx'
import ScanRow from './ScanRow.jsx'
import { isSameDay } from '../storage.js'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export default function Dashboard({ scans, onScan, onSheet, onHistory, onOpen }) {
  const now = new Date()
  const todayCount = scans.filter((s) => isSameDay(new Date(s.scannedAt), now)).length
  const weekCount = scans.filter((s) => now.getTime() - new Date(s.scannedAt).getTime() < WEEK_MS).length

  const byLocation = new Map()
  for (const s of scans) {
    const key = s.location?.trim() || ''
    byLocation.set(key, (byLocation.get(key) ?? 0) + 1)
  }
  const locations = [...byLocation.entries()].sort((a, b) => b[1] - a[1])
  const namedLocations = locations.filter(([name]) => name).length
  const topLocations = locations.slice(0, 6)
  const maxCount = topLocations[0]?.[1] ?? 1

  const stats = [
    { label: 'Items in stock list', value: scans.length },
    { label: 'Scanned today', value: todayCount },
    { label: 'Last 7 days', value: weekCount },
    { label: 'Locations', value: namedLocations },
  ]

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader title="Dashboard" description="Serial numbers read from device labels, saved in this browser.">
        <Button variant="secondary" onClick={onSheet}>
          <Sheet aria-hidden="true" />
          Open spreadsheet
        </Button>
        <Button onClick={onScan}>
          <ScanText aria-hidden="true" />
          Open scanner
        </Button>
      </PageHeader>

      <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={[
              'px-5 py-4',
              i % 2 === 1 ? 'border-l border-border' : '',
              i >= 2 ? 'border-t border-border lg:border-t-0' : '',
              i === 2 ? 'lg:border-l' : '',
            ].join(' ')}
          >
            <dt className="text-sm text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 font-mono text-3xl font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      {scans.length === 0 ? (
        <section className="rounded-lg border border-dashed border-input bg-card px-6 py-12 text-center">
          <ScanText className="mx-auto size-10 text-subtle-foreground" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold">No items yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Point the scanner at the S/N on a device label, or type the serial number in.
          </p>
          <Button className="mt-5" onClick={onScan}>
            <ScanText aria-hidden="true" />
            Open scanner
          </Button>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section aria-labelledby="recent-heading" className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 id="recent-heading" className="font-semibold">
                Recently scanned
              </h2>
              <Button variant="ghost" size="sm" onClick={onHistory}>
                View history
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
            <ul>
              {scans.slice(0, 6).map((s) => (
                <ScanRow key={s.id} scan={s} onOpen={onOpen} />
              ))}
            </ul>
          </section>

          <section aria-labelledby="loc-heading" className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 id="loc-heading" className="font-semibold">
                Items by location
              </h2>
            </div>
            <ul className="space-y-3 px-4 py-4">
              {topLocations.map(([name, count]) => (
                <li key={name || '__none'}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={name ? 'truncate' : 'truncate italic text-subtle-foreground'}>
                      {name || 'No location'}
                    </span>
                    <span className="font-mono tabular-nums text-muted-foreground">{count}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </main>
  )
}

import { ArrowRight, CalendarDays, Camera, ChevronRight, MapPin, Package, ScanText, Sheet } from 'lucide-react'
import { Button, Card, CardTitle } from './ui.jsx'
import { EmptyState, PageHeader, StatCard } from './Layout.jsx'
import ScanRow from './ScanRow.jsx'
import { formatLongDate, formatRelative, isSameDay, locationGroups } from '../storage.js'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** `onLocation(key)` opens History on that location's tab. */
export default function Dashboard({ scans, onScan, onPhoto, onSheet, onHistory, onLocation, onOpen }) {
  const now = new Date()
  const todayCount = scans.filter((s) => isSameDay(new Date(s.scannedAt), now)).length
  const weekCount = scans.filter((s) => now.getTime() - new Date(s.scannedAt).getTime() < WEEK_MS).length
  const missingSerial = scans.filter((s) => !s.serial?.trim()).length
  const latest = scans.reduce((a, s) => (!a || s.scannedAt > a.scannedAt ? s : a), null)

  // Same grouping as the location tabs, so the counts match. Busiest first.
  const locations = locationGroups(scans).sort((a, b) => b.count - a.count)
  const namedLocations = locations.filter((g) => g.key).length
  const noLocation = locations.find((g) => !g.key)?.count ?? 0
  const topLocations = locations.slice(0, 6)
  const maxCount = topLocations[0]?.count ?? 1

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Dashboard"
        description={`${formatLongDate(now)} · serial numbers read from device labels`}
        actions={
          <>
            <Button variant="outline" onClick={onSheet}>
              <Sheet aria-hidden="true" />
              Open spreadsheet
            </Button>
            <Button variant="outline" onClick={onPhoto}>
              <Camera aria-hidden="true" />
              Take photo
            </Button>
            <Button onClick={onScan}>
              <ScanText aria-hidden="true" />
              Open scanner
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Items"
          value={scans.length}
          icon={Package}
          tone={missingSerial ? 'warning' : 'default'}
          hint={missingSerial ? `${missingSerial} without a serial number` : 'In the stock list'}
        />
        <StatCard
          label="Scanned today"
          value={todayCount}
          icon={ScanText}
          hint={latest ? `Last scan ${formatRelative(latest.scannedAt, now).toLowerCase()}` : 'Nothing scanned yet'}
        />
        <StatCard label="Last 7 days" value={weekCount} icon={CalendarDays} hint="Scans in the past week" />
        <StatCard
          label="Locations"
          value={namedLocations}
          icon={MapPin}
          hint={noLocation ? `${noLocation} ${noLocation === 1 ? 'item' : 'items'} with no location` : 'Every item has a location'}
        />
      </div>

      {scans.length === 0 ? (
        <EmptyState
          icon={ScanText}
          as="h2"
          title="No items yet"
          description="Point the scanner at the S/N on a device label, or type the serial number in."
          action={
            <Button variant="outline" onClick={onSheet}>
              <Sheet aria-hidden="true" />
              Add rows by hand
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card as="section" aria-labelledby="recent-heading" className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b px-5 py-3">
              <CardTitle id="recent-heading">Recently scanned</CardTitle>
              <Button variant="ghost" size="sm" onClick={onHistory} className="-mr-2">
                View history
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
            <ul>
              {scans.slice(0, 6).map((s) => (
                <ScanRow key={s.id} scan={s} onOpen={onOpen} />
              ))}
            </ul>
          </Card>

          <Card as="section" aria-labelledby="loc-heading" className="self-start">
            <div className="border-b px-5 py-4">
              <CardTitle id="loc-heading">Items by location</CardTitle>
            </div>
            <ul className="grid gap-1 px-2 py-2">
              {topLocations.map(({ key, label, count }) => (
                <li key={key || '__none'}>
                  <button
                    type="button"
                    onClick={() => onLocation(key)}
                    className="group w-full rounded-md px-3 py-2 text-left transition-colors duration-150 outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring"
                    title={`See the items ${key ? `in ${label}` : 'with no location'}`}
                  >
                    <span className="flex items-baseline justify-between gap-3 text-sm">
                      <span className={key ? 'truncate' : 'truncate text-muted-foreground italic'}>{label}</span>
                      <span className="flex items-center gap-1 font-mono text-muted-foreground tabular-nums">
                        {count}
                        <span className="sr-only">{count === 1 ? ' item' : ' items'}</span>
                        <ChevronRight className="size-3.5 translate-y-0.5 opacity-50 group-hover:opacity-100" aria-hidden="true" />
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${(count / maxCount) * 100}%` }} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  )
}

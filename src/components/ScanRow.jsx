import { ChevronRight, TriangleAlert, UserRound } from 'lucide-react'
import { Badge } from './ui.jsx'
import { formatTime, itemName } from '../storage.js'

/** One scanned item in a list. The main area opens the item; `children` holds row actions. */
export default function ScanRow({ scan, onOpen, children }) {
  const name = itemName(scan)
  const details = [scan.model, scan.color, scan.location].filter(Boolean)

  return (
    <li className="flex items-center gap-1 border-b last:border-b-0">
      <button
        type="button"
        onClick={() => onOpen?.(scan.id)}
        className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3 text-left transition-colors duration-150 outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset"
      >
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={name ? 'text-sm font-medium' : 'text-sm text-muted-foreground italic'}>{name || 'Unnamed item'}</span>
            {scan.serial ? (
              <span className="font-mono text-[13px] break-all text-muted-foreground">{scan.serial}</span>
            ) : (
              <Badge variant="warning">
                <TriangleAlert aria-hidden="true" />
                No serial number
              </Badge>
            )}
          </p>
          {(scan.user || details.length > 0 || scan.note) && (
            <p className="truncate text-xs text-muted-foreground">
              {scan.user && (
                <span className="font-medium text-foreground/80">
                  <UserRound className="mr-1 inline size-3.5 -translate-y-px" aria-hidden="true" />
                  <span className="sr-only">User: </span>
                  {scan.user}
                  {(details.length > 0 || scan.note) && ' · '}
                </span>
              )}
              {details.join(' · ')}
              {details.length > 0 && scan.note ? ' · ' : ''}
              {scan.note && <span className="italic">{scan.note}</span>}
            </p>
          )}
        </div>
        <time dateTime={scan.scannedAt} className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {formatTime(scan.scannedAt)}
        </time>
        {!children && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      </button>
      {children && <div className="shrink-0 pr-3">{children}</div>}
    </li>
  )
}

import { ChevronRight } from 'lucide-react'
import { formatTime, itemName } from '../storage.js'

/** One scanned item in a list. The main area opens the item; `children` holds row actions. */
export default function ScanRow({ scan, onOpen, children }) {
  const name = itemName(scan)
  const details = [scan.model, scan.color, scan.location].filter(Boolean)

  return (
    <li className="group flex items-center gap-2 border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => onOpen?.(scan.id)}
        className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/60"
      >
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className={name ? 'font-medium' : 'italic text-subtle-foreground'}>{name || 'Unnamed item'}</span>
            <span className="font-mono text-sm text-muted-foreground break-all">{scan.serial || 'No serial number'}</span>
          </p>
          {(details.length > 0 || scan.note) && (
            <p className="mt-0.5 truncate text-sm text-subtle-foreground">
              {details.join(', ')}
              {details.length > 0 && scan.note ? '. ' : ''}
              {scan.note && <span className="italic">{scan.note}</span>}
            </p>
          )}
        </div>
        <time dateTime={scan.scannedAt} className="shrink-0 font-mono text-xs tabular-nums text-subtle-foreground">
          {formatTime(scan.scannedAt)}
        </time>
        {!children && <ChevronRight className="size-4 shrink-0 text-subtle-foreground" aria-hidden="true" />}
      </button>
      {children && <div className="shrink-0 pr-3">{children}</div>}
    </li>
  )
}

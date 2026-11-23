import { useState } from 'react'
import { Expand } from 'lucide-react'
import { Dialog } from './ui.jsx'
import { cn, focusRing } from '../lib/utils.js'

const ALT = 'Photo of the serial number label'

/**
 * A label photo that fits its box (letterboxed on black), and opens full size on tap.
 * `src` is an object URL; whoever created it revokes it.
 */
export default function PhotoView({ src, className }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('group relative block w-full overflow-hidden rounded-lg border bg-black', focusRing, className)}
      >
        <img src={src} alt={ALT} className="size-full object-contain" />
        <span className="absolute right-2 bottom-2 flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm transition-colors duration-150 group-hover:bg-black/85">
          <Expand className="size-3.5" aria-hidden="true" />
          Enlarge
        </span>
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Label photo" className="max-w-4xl" bodyClassName="bg-black p-0">
        <img src={src} alt={ALT} className="mx-auto max-h-[calc(100dvh-8rem)] w-auto object-contain" />
      </Dialog>
    </>
  )
}

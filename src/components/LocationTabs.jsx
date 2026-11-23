import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/utils.js'

const styles = {
  // Underlined tabs above a list. The baseline is an inset shadow, so nothing hangs outside the strip.
  bar: {
    list: 'shadow-[inset_0_-1px_0_var(--border)]',
    tab: 'h-10 border-b-2 px-3 text-sm',
    on: 'border-foreground font-medium text-foreground',
    off: 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
    count: 'bg-muted text-muted-foreground',
    countOn: 'bg-primary text-primary-foreground',
  },
  // Sheet tabs along the bottom of the spreadsheet, as in Google Sheets. The strip sits 1 px over
  // the bar's top border, so the selected tab's top edge replaces it.
  sheet: {
    list: '-mt-px h-[calc(100%+1px)]',
    tab: 'h-full border-x border-t-2 px-4 text-sm',
    on: 'border-x-border border-t-foreground bg-card font-medium text-foreground',
    off: 'border-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground',
    count: 'bg-background/70 text-muted-foreground',
    countOn: 'bg-muted text-foreground',
  },
}

const FADE = '2rem'

/** Fades the side(s) with more tabs out of view, so it's clear the strip scrolls. */
function fadeMask({ left, right }) {
  if (!left && !right) return undefined
  const from = left ? `transparent, #000 ${FADE}` : '#000'
  const to = right ? `#000 calc(100% - ${FADE}), transparent` : '#000'
  const mask = `linear-gradient(to right, ${from}, ${to})`
  return { maskImage: mask, WebkitMaskImage: mask }
}

/**
 * Tabs that split the stock list by location: All, each place by name, then No location.
 * `groups` comes from locationGroups(); `value` is a group key, or null for All.
 * Arrow keys, Home and End move between the tabs. `panelId` is the list the tabs show.
 * With more tabs than fit, the strip scrolls sideways: swipe, the mouse wheel, or the arrow keys.
 */
export default function LocationTabs({ groups, total, value, onChange, panelId, variant = 'bar', className }) {
  const listRef = useRef(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  const s = styles[variant]
  const tabs = [{ key: null, label: 'All', count: total }, ...groups]
  const selected = Math.max(0, tabs.findIndex((t) => t.key === value))

  // Which ends have tabs out of view. The observer also reports once when it starts.
  useEffect(() => {
    const list = listRef.current
    const measure = () => {
      const left = list.scrollLeft > 1
      const right = list.scrollLeft + list.clientWidth < list.scrollWidth - 1
      setEdges((e) => (e.left === left && e.right === right ? e : { left, right }))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    list.addEventListener('scroll', measure, { passive: true })
    // A mouse wheel scrolls the strip sideways while it can, then the page as usual.
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const max = list.scrollWidth - list.clientWidth
      if ((e.deltaY < 0 && list.scrollLeft <= 0) || (e.deltaY > 0 && list.scrollLeft >= max - 1)) return
      e.preventDefault()
      list.scrollLeft += e.deltaY
    }
    list.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      observer.disconnect()
      list.removeEventListener('scroll', measure)
      list.removeEventListener('wheel', onWheel)
    }
  }, [])

  // Keep the selected tab in view. Only the strip scrolls, never the page.
  useEffect(() => {
    const list = listRef.current
    const tab = list.children[selected]
    if (!tab) return
    const pad = 40 // clear of the fade
    if (tab.offsetLeft < list.scrollLeft + pad) list.scrollLeft = tab.offsetLeft - pad
    else if (tab.offsetLeft + tab.offsetWidth > list.scrollLeft + list.clientWidth - pad)
      list.scrollLeft = tab.offsetLeft + tab.offsetWidth - list.clientWidth + pad
  }, [selected, tabs.length])

  function onKeyDown(e) {
    const last = tabs.length - 1
    const next = { ArrowLeft: selected - 1, ArrowRight: selected + 1, Home: 0, End: last }[e.key]
    if (next === undefined) return
    e.preventDefault()
    const i = next < 0 ? last : next > last ? 0 : next
    onChange(tabs[i].key)
    listRef.current.children[i]?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Locations"
      onKeyDown={onKeyDown}
      style={fadeMask(edges)}
      className={cn(
        'relative flex min-w-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        s.list,
        className,
      )}
    >
      {tabs.map((tab, i) => {
        const on = i === selected
        return (
          <button
            key={tab.key ?? 'all'}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={panelId}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(tab.key)}
            title={tab.key === null ? 'Every location' : tab.label}
            className={cn(
              'flex shrink-0 items-center gap-2 whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset',
              s.tab,
              on ? s.on : s.off,
            )}
          >
            <span className={cn('max-w-48 truncate', tab.key === '' && 'italic')}>{tab.label}</span>
            <span className={cn('rounded px-1.5 text-xs leading-5 font-normal tabular-nums', on ? s.countOn : s.count)}>
              {tab.count}
              <span className="sr-only">{tab.count === 1 ? ' item' : ' items'}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

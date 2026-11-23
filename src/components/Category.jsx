import { CircuitBoard, Cpu, Gpu, HardDrive, Keyboard, MemoryStick, Monitor, Mouse, Package, Tag } from 'lucide-react'
import { Badge, Select } from './ui.jsx'
import { CATEGORIES, categoryKey, tidyCategory } from '../storage.js'
import { cn } from '../lib/utils.js'

const ICONS = {
  keyboard: Keyboard,
  mouse: Mouse,
  monitor: Monitor,
  ram: MemoryStick,
  processor: Cpu,
  'graphics card': Gpu,
  storage: HardDrive,
  motherboard: CircuitBoard,
  other: Package,
}

/** The category's icon. A category typed into the sheet that the list doesn't have gets a tag. */
export function CategoryIcon({ category, className }) {
  const Icon = ICONS[categoryKey(category)] ?? Tag
  return <Icon className={className} aria-hidden="true" />
}

/** The item's category as a small label with its icon. Nothing when it has none. */
export function CategoryBadge({ category, className }) {
  const label = tidyCategory(category)
  if (!label) return null
  return (
    <Badge variant="muted" className={className}>
      <CategoryIcon category={label} />
      <span className="sr-only">Category: </span>
      {label}
    </Badge>
  )
}

/**
 * Picks an item's category from the list. A category typed into the sheet that the list doesn't
 * have stays selectable, so opening the item doesn't lose it.
 */
export function CategorySelect({ value, onChange, className, ...props }) {
  const current = tidyCategory(value)
  const options = current && !CATEGORIES.includes(current) ? [...CATEGORIES, current] : CATEGORIES
  return (
    <Select className={className} value={current} onChange={(e) => onChange(e.target.value)} {...props}>
      <option value="">No category</option>
      {options.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </Select>
  )
}

/**
 * Narrows a list to one category. `groups` comes from categoryGroups(); `value` is a group key,
 * or null for all. A picked category the list no longer has stays shown, with 0.
 */
export function CategoryFilter({ id, groups, total, value, onChange, className }) {
  const options =
    value != null && !groups.some((g) => g.key === value)
      ? [...groups, { key: value, label: tidyCategory(value) || 'No category', count: 0 }]
      : groups
  return (
    <>
      <label htmlFor={id} className="sr-only">
        Category
      </label>
      <Select
        id={id}
        className={cn('w-full sm:w-52', className)}
        selectClassName={cn(value != null && 'border-foreground/40 font-medium')}
        value={value ?? '*'}
        onChange={(e) => onChange(e.target.value === '*' ? null : e.target.value)}
      >
        <option value="*">All categories ({total})</option>
        {options.map((g) => (
          <option key={g.key || '__none'} value={g.key}>
            {g.label} ({g.count})
          </option>
        ))}
      </Select>
    </>
  )
}

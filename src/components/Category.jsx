import {
  CircleDashed,
  CircuitBoard,
  Cpu,
  Gpu,
  HardDrive,
  Keyboard,
  LayoutGrid,
  MemoryStick,
  Monitor,
  Mouse,
  Package,
  Tag,
} from 'lucide-react'
import { Badge, Select } from './ui.jsx'
import { CATEGORIES, categoryColor, categoryKey, tidyCategory } from '../storage.js'
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

/**
 * The category's icon, in the category's color. A category typed into the sheet that the list
 * doesn't have gets a gray tag; no category gets a dashed circle.
 */
export function CategoryIcon({ category, className }) {
  const key = categoryKey(category)
  const Icon = key ? (ICONS[key] ?? Tag) : CircleDashed
  return <Icon className={cn(!key && 'text-muted-foreground', className)} style={{ color: categoryColor(key) ?? undefined }} aria-hidden="true" />
}

/**
 * The item's category as a small label: tinted in the category's color, with its icon. The words
 * stay in the text color, so they read the same in every category. Nothing when it has none.
 */
export function CategoryBadge({ category, className }) {
  const label = tidyCategory(category)
  if (!label) return null
  const color = categoryColor(label)
  return (
    <Badge
      className={cn('text-foreground', className)}
      style={{
        backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
        borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
      }}
    >
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
    <Select
      className={className}
      leading={<CategoryIcon category={current} />}
      value={current}
      onChange={(e) => onChange(e.target.value)}
      {...props}
    >
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
        leading={value == null ? <LayoutGrid className="text-muted-foreground" /> : <CategoryIcon category={value} />}
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

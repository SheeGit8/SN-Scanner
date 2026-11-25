import {
  CircleDashed,
  CircuitBoard,
  Cpu,
  Fan,
  Gpu,
  HardDrive,
  Keyboard,
  LayoutGrid,
  MemoryStick,
  Monitor,
  Mouse,
  Package,
  PlugZap,
  Smartphone,
  Tag,
  Usb,
  Video,
} from 'lucide-react'
import { Badge, Select } from './ui.jsx'
import { CATEGORIES, CATEGORY_GROUPS, categoryColor, categoryKey, tidyCategory } from '../storage.js'
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
  phone: Smartphone,
  'car charger': PlugZap,
  fan: Fan,
  'dash cam': Video,
  'usb cable': Usb,
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
      title={label} // the full name when a long one is shortened; the item's details show it too
      style={{
        backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
        borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
      }}
    >
      <CategoryIcon category={label} />
      <span className="sr-only">Category: </span>
      <span className="min-w-0 truncate">{label}</span>
    </Badge>
  )
}

/**
 * The options of a category dropdown: No category, the Office and Drivers groups, then Other.
 * `value` is the dropdown's value; one the list doesn't have (typed into the sheet) is added at
 * the end, so opening the dropdown doesn't lose it.
 */
export function CategoryOptions({ value }) {
  return (
    <>
      <option value="">No category</option>
      {CATEGORY_GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </optgroup>
      ))}
      <option value="Other">Other</option>
      {value && !CATEGORIES.includes(value) && <option value={value}>{value}</option>}
    </>
  )
}

/** Picks an item's category from the list. */
export function CategorySelect({ value, onChange, className, ...props }) {
  const current = tidyCategory(value)
  return (
    <Select
      className={className}
      leading={<CategoryIcon category={current} />}
      value={current}
      onChange={(e) => onChange(e.target.value)}
      {...props}
    >
      <CategoryOptions value={current} />
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

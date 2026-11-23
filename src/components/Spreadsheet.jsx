import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Download, PanelRightOpen, Plus, Search, Trash2 } from 'lucide-react'
import { Button, ConfirmDialog, Input, Kbd } from './ui.jsx'
import { downloadCsv, formatDate, formatTime, itemName, methodLabel } from '../storage.js'
import { cn } from '../lib/utils.js'
import { deletedFrom } from '../lib/api.js'
import { useToast } from '../lib/toast.js'

const formatStamp = (iso) => `${formatDate(iso)} · ${formatTime(iso)}`

// Column order follows the CSV export so the sheet and the file line up.
const COLUMNS = [
  { key: 'serial', label: 'Serial number', width: 168, mono: true },
  { key: 'name', label: 'Name', width: 200, get: itemName },
  { key: 'user', label: 'User', width: 180 },
  { key: 'model', label: 'Model', width: 150 },
  { key: 'color', label: 'Color', width: 110 },
  { key: 'location', label: 'Location', width: 180 },
  { key: 'note', label: 'Note', width: 240 },
  { key: 'source', label: 'Method', width: 96, readOnly: true, get: methodLabel },
  { key: 'scannedAt', label: 'Scanned at', width: 176, readOnly: true, mono: true, get: (s) => formatStamp(s.scannedAt) },
]

const ROW_HEADER_W = 48
// Blank rows drawn under the data so the grid fills the view like a real sheet.
const MIN_ROWS = 40
const letter = (i) => String.fromCharCode(65 + i)
const cellText = (scan, col) => String(col.get ? col.get(scan) : (scan[col.key] ?? ''))
const cellId = (rowId, c) => `cell-${rowId}-${c}`

function compareRows(a, b, key) {
  if (key === 'scannedAt') return a.scannedAt.localeCompare(b.scannedAt)
  const col = COLUMNS.find((c) => c.key === key)
  const x = cellText(a, col)
  const y = cellText(b, col)
  if (!x !== !y) return x ? -1 : 1 // blanks always last
  return x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' })
}

export default function Spreadsheet({ scans, focusId, onUpdate, onAddRow, onDeleteMany, onOpenItem }) {
  const gridRef = useRef(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'scannedAt', dir: 'desc' })
  const [active, setActive] = useState(() => ({ id: focusId ?? scans[0]?.id ?? null, c: 0 }))
  const [editing, setEditing] = useState(null) // { value, from: 'cell' | 'bar' }
  const [selected, setSelected] = useState(() => (focusId ? new Set([focusId]) : new Set()))
  const [anchorId, setAnchorId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const toast = useToast()

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? scans.filter((s) => COLUMNS.some((col) => cellText(s, col).toLowerCase().includes(q)))
      : [...scans]
    list.sort((a, b) => compareRows(a, b, sort.key) * (sort.dir === 'asc' ? 1 : -1))
    return list
  }, [scans, query, sort])

  // The active cell is tracked by row id so it survives sorting and filtering.
  let r = rows.findIndex((s) => s.id === active.id)
  if (r === -1) r = rows.length ? 0 : -1
  const c = active.c
  const activeRow = r >= 0 ? rows[r] : null
  const col = COLUMNS[c]
  const activeValue = activeRow ? cellText(activeRow, col) : ''
  const selectedIds = [...selected].filter((id) => scans.some((s) => s.id === id))

  useEffect(() => {
    if (!activeRow) return
    document.getElementById(cellId(activeRow.id, c))?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeRow, c])

  const focusGrid = () => gridRef.current?.focus({ preventScroll: true })

  function moveTo(nr, nc) {
    if (!rows.length) return
    const rr = Math.max(0, Math.min(rows.length - 1, nr))
    const cc = Math.max(0, Math.min(COLUMNS.length - 1, nc))
    setActive({ id: rows[rr].id, c: cc })
  }

  function startEdit(initial, from = 'cell') {
    if (!activeRow || col.readOnly) return
    setEditing({ value: initial ?? activeValue, from })
  }

  function commit(move) {
    if (editing && activeRow && !col.readOnly) {
      const next = editing.value.trim()
      if (next !== activeValue) onUpdate(activeRow.id, { [col.key]: next })
    }
    setEditing(null)
    if (move) moveTo(r + move[0], c + move[1])
    focusGrid()
  }

  function cancelEdit() {
    setEditing(null)
    focusGrid()
  }

  function onGridKeyDown(e) {
    if (editing || !activeRow) return
    const { key } = e
    const mod = e.ctrlKey || e.metaKey
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }

    if (key === ' ' && e.shiftKey) {
      // Shift+Space selects the row, as in Google Sheets.
      e.preventDefault()
      selectRow(activeRow.id, { ctrlKey: true })
      return
    }
    if (mod && key.toLowerCase() === 'a') {
      e.preventDefault()
      setSelected(new Set(rows.map((s) => s.id)))
      return
    }
    if (key === 'Escape' && selected.size) {
      setSelected(new Set())
      setConfirmDelete(false)
      return
    }

    if (moves[key]) {
      e.preventDefault()
      const [dr, dc] = moves[key]
      if (mod) moveTo(dr ? (dr < 0 ? 0 : rows.length - 1) : r, dc ? (dc < 0 ? 0 : COLUMNS.length - 1) : c)
      else moveTo(r + dr, c + dc)
    } else if (key === 'Tab') {
      const nc = c + (e.shiftKey ? -1 : 1)
      if (nc >= 0 && nc < COLUMNS.length) {
        e.preventDefault()
        moveTo(r, nc)
      }
    } else if (key === 'Home') {
      e.preventDefault()
      moveTo(mod ? 0 : r, 0)
    } else if (key === 'End') {
      e.preventDefault()
      moveTo(mod ? rows.length - 1 : r, COLUMNS.length - 1)
    } else if (key === 'Enter' || key === 'F2') {
      e.preventDefault()
      startEdit()
    } else if (key === 'Delete' || key === 'Backspace') {
      if (!col.readOnly && activeValue) {
        e.preventDefault()
        onUpdate(activeRow.id, { [col.key]: '' })
      }
    } else if (mod && key.toLowerCase() === 'c') {
      navigator.clipboard?.writeText(activeValue)
    } else if (key.length === 1 && !mod && !e.altKey && !col.readOnly) {
      e.preventDefault()
      startEdit(key)
    }
  }

  function onEditorKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit([e.shiftKey ? -1 : 1, 0])
    } else if (e.key === 'Tab') {
      e.preventDefault()
      commit([0, e.shiftKey ? -1 : 1])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cancelEdit()
    }
  }

  function selectRow(id, e) {
    setActive((a) => ({ id, c: a.c }))
    if (e.shiftKey && anchorId) {
      const from = rows.findIndex((s) => s.id === anchorId)
      const to = rows.findIndex((s) => s.id === id)
      const [lo, hi] = from < to ? [from, to] : [to, from]
      setSelected(new Set(rows.slice(lo, hi + 1).map((s) => s.id)))
    } else {
      setSelected((prev) => {
        const next = e.ctrlKey || e.metaKey ? new Set(prev) : new Set()
        if (prev.has(id) && (e.ctrlKey || e.metaKey || prev.size === 1)) next.delete(id)
        else next.add(id)
        return next
      })
      setAnchorId(id)
    }
    setConfirmDelete(false)
  }

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  function addRow() {
    const id = onAddRow()
    setQuery('')
    setSort({ key: 'scannedAt', dir: 'desc' })
    setActive({ id, c: 0 })
    setSelected(new Set())
    setEditing({ value: '', from: 'cell' })
  }

  const allSelected = rows.length > 0 && rows.every((s) => selected.has(s.id))
  const tableWidth = ROW_HEADER_W + COLUMNS.reduce((sum, col) => sum + col.width, 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      {/* Title + toolbar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b px-4 py-4 sm:px-6">
        <div className="mr-auto grid min-w-0 gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Spreadsheet</h1>
          <p className="text-xs text-muted-foreground pointer-coarse:hidden">
            Double-click or start typing to edit a cell. <Kbd>Shift</Kbd> + <Kbd>Space</Kbd> selects a row. Changes save
            automatically.
          </p>
          <p className="hidden text-xs text-muted-foreground pointer-coarse:block">
            Double-tap a cell to edit it. Tap a row number to select the row. Changes save automatically.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="sheet-search" className="sr-only">
            Filter rows
          </label>
          <Input
            id="sheet-search"
            type="search"
            placeholder="Filter rows"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={addRow}>
            <Plus aria-hidden="true" />
            Add row
          </Button>
          <Button variant="outline" size="sm" disabled={!activeRow} onClick={() => onOpenItem(activeRow.id)}>
            <PanelRightOpen aria-hidden="true" />
            Details
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!selectedIds.length}
            onClick={() => setConfirmDelete(true)}
            title={selectedIds.length ? undefined : 'Select rows by clicking their numbers'}
          >
            <Trash2 aria-hidden="true" />
            Delete rows{selectedIds.length > 0 && ` (${selectedIds.length})`}
          </Button>
          <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => downloadCsv(rows)}>
            <Download aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Formula bar */}
      <div className="flex h-9 items-stretch border-b text-sm">
        <div
          className="flex w-20 shrink-0 items-center justify-center border-r font-mono text-xs font-medium text-muted-foreground tabular-nums"
          aria-label="Selected cell"
        >
          {activeRow ? `${letter(c)}${r + 2}` : ''}
        </div>
        <div className="flex shrink-0 items-center border-r px-3 font-serif text-sm text-muted-foreground italic" aria-hidden="true">
          fx
        </div>
        <label htmlFor="formula-bar" className="sr-only">
          {activeRow ? `${col.label}, row ${r + 2}` : 'Cell value'}
        </label>
        <input
          id="formula-bar"
          className={cn(
            'min-w-0 flex-1 bg-transparent px-3 text-base outline-none focus-visible:bg-muted/50 sm:text-sm',
            col?.mono && 'font-mono',
          )}
          value={editing ? editing.value : activeValue}
          readOnly={!activeRow || col.readOnly}
          onFocus={() => !editing && activeRow && !col.readOnly && startEdit(undefined, 'bar')}
          onChange={(e) => setEditing({ value: e.target.value, from: 'bar' })}
          onKeyDown={onEditorKeyDown}
          onBlur={() => editing?.from === 'bar' && commit(null)}
          autoComplete="off"
          spellCheck="false"
        />
      </div>

      {/* Grid */}
      <div className="relative min-h-0 flex-1 overflow-auto bg-card">
        <table
          ref={gridRef}
          role="grid"
          tabIndex={0}
          aria-label="Scanned items spreadsheet"
          aria-rowcount={rows.length + 1}
          aria-colcount={COLUMNS.length}
          aria-multiselectable="true"
          aria-activedescendant={activeRow && !editing ? cellId(activeRow.id, c) : undefined}
          onKeyDown={onGridKeyDown}
          className="table-fixed border-separate border-spacing-0 text-sm outline-none"
          style={{ width: tableWidth }}
        >
          <colgroup>
            <col style={{ width: ROW_HEADER_W }} />
            {COLUMNS.map((column) => (
              <col key={column.key} style={{ width: column.width }} />
            ))}
          </colgroup>

          <thead>
            {/* Column letters */}
            <tr aria-hidden="true">
              <th
                className="sticky top-0 left-0 z-30 h-6 border-r border-b bg-muted"
                onClick={() => setSelected(allSelected ? new Set() : new Set(rows.map((s) => s.id)))}
                title="Select all rows"
              />
              {COLUMNS.map((column, i) => (
                <th
                  key={column.key}
                  className={cn(
                    'sticky top-0 z-20 h-6 border-r border-b bg-muted text-center text-xs font-normal text-muted-foreground',
                    i === c && activeRow && 'bg-grid-active font-semibold text-foreground',
                  )}
                >
                  {letter(i)}
                </th>
              ))}
            </tr>
            {/* Row 1: frozen field names */}
            <tr aria-rowindex={1}>
              <th
                scope="row"
                className="sticky top-6 left-0 z-30 h-8 border-r border-b-2 border-b-input bg-muted text-center text-xs font-normal text-muted-foreground"
              >
                1
              </th>
              {COLUMNS.map((column, i) => {
                const sorted = sort.key === column.key
                const SortIcon = sorted ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-colindex={i + 1}
                    aria-sort={sorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="sticky top-6 z-20 h-8 border-r border-b-2 border-b-input bg-card p-0"
                  >
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => toggleSort(column.key)}
                      className="flex h-full w-full items-center gap-1.5 px-2 text-left text-xs font-semibold hover:bg-muted"
                      title={`Sort by ${column.label}`}
                    >
                      <span className="truncate">{column.label}</span>
                      <SortIcon
                        className={cn('ml-auto size-3.5 shrink-0', sorted ? 'text-foreground' : 'text-muted-foreground/50')}
                        aria-hidden="true"
                      />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {scans.length === 0
                    ? 'No rows yet. Add a row, or scan an item to fill the sheet.'
                    : `No rows match “${query}”.`}
                </td>
              </tr>
            ) : (
              rows.map((scan, ri) => {
                const isSelected = selected.has(scan.id)
                const isActiveRow = ri === r
                return (
                  <tr key={scan.id} aria-rowindex={ri + 2} aria-selected={isSelected}>
                    <th
                      scope="row"
                      onClick={(e) => selectRow(scan.id, e)}
                      className={cn(
                        'sticky left-0 z-10 h-8 cursor-pointer border-r border-b bg-muted text-center text-xs font-normal text-muted-foreground tabular-nums select-none hover:bg-grid-active',
                        isActiveRow && 'bg-grid-active font-semibold text-foreground',
                        isSelected && 'bg-primary text-primary-foreground hover:bg-primary',
                      )}
                      title="Select row (Shift or Ctrl to select more)"
                    >
                      {ri + 2}
                    </th>
                    {COLUMNS.map((column, ci) => {
                      const isActive = isActiveRow && ci === c
                      const text = cellText(scan, column)
                      const isEditingHere = isActive && editing?.from === 'cell'
                      return (
                        <td
                          key={column.key}
                          id={cellId(scan.id, ci)}
                          role="gridcell"
                          aria-colindex={ci + 1}
                          aria-selected={isActive}
                          aria-readonly={column.readOnly || undefined}
                          onMouseDown={() => {
                            if (isActive) return
                            // Save an open edit to its own cell before the selection moves.
                            if (editing) commit(null)
                            setActive({ id: scan.id, c: ci })
                          }}
                          onDoubleClick={() => startEdit()}
                          className={cn(
                            'relative h-8 scroll-mt-14 scroll-ml-12 overflow-hidden border-r border-b px-2 whitespace-nowrap text-ellipsis',
                            column.mono && 'font-mono text-[13px]',
                            column.readOnly && 'text-muted-foreground',
                            isSelected && 'bg-muted/70',
                            isActive && 'z-[1] outline-2 -outline-offset-2 outline-foreground',
                          )}
                        >
                          {isEditingHere ? (
                            <input
                              autoFocus
                              aria-label={`${column.label}, row ${ri + 2}`}
                              className={cn(
                                'absolute inset-0 w-full bg-background px-2 outline-2 -outline-offset-2 outline-foreground',
                                column.mono && 'font-mono text-[13px]',
                              )}
                              value={editing.value}
                              onChange={(e) => setEditing({ value: e.target.value, from: 'cell' })}
                              onKeyDown={onEditorKeyDown}
                              onBlur={() => commit(null)}
                              autoComplete="off"
                              spellCheck="false"
                            />
                          ) : (
                            text || (column.key === 'serial' && <span className="text-destructive">Missing</span>)
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
            {Array.from({ length: Math.max(0, MIN_ROWS - rows.length) }, (_, i) => (
              <tr key={`pad-${i}`} aria-hidden="true">
                <th className="sticky left-0 z-10 h-8 border-r border-b bg-muted text-center text-xs font-normal text-muted-foreground/70 tabular-nums">
                  {rows.length + i + 2}
                </th>
                {COLUMNS.map((column) => (
                  <td key={column.key} className="h-8 border-r border-b" />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sheet tabs / status bar */}
      <div className="flex h-10 shrink-0 items-stretch border-t bg-muted text-sm">
        <span className="-mt-px flex items-center border-x border-t-2 border-t-foreground bg-card px-4 font-medium">Scans</span>
        <p className="ml-auto flex items-center gap-4 px-4 text-xs text-muted-foreground tabular-nums" role="status">
          {selectedIds.length > 0 && <span>{selectedIds.length} selected</span>}
          <span>
            {query ? `${rows.length} of ${scans.length} rows` : `${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`}
          </span>
        </p>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${selectedIds.length} ${selectedIds.length === 1 ? 'row' : 'rows'}?`}
        description={`Removes the selected items ${deletedFrom}. This can’t be undone.`}
        cancelLabel="Keep rows"
        confirmLabel={selectedIds.length === 1 ? 'Delete row' : `Delete ${selectedIds.length} rows`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          const n = selectedIds.length
          onDeleteMany(selectedIds)
          setSelected(new Set())
          setConfirmDelete(false)
          toast(`Deleted ${n} ${n === 1 ? 'row' : 'rows'}.`)
          focusGrid()
        }}
      />
    </div>
  )
}

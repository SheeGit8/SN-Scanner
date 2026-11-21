import { useEffect, useState } from 'react'
import { Menu, ScanText } from 'lucide-react'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './components/Home.jsx'
import Scanner from './components/Scanner.jsx'
import History from './components/History.jsx'
import Spreadsheet from './components/Spreadsheet.jsx'
import ItemDrawer from './components/ItemDrawer.jsx'
import { Button } from './components/ui/button.jsx'
import { loadScans, makeId, saveScans } from './storage.js'
import './App.css'

const VIEWS = ['home', 'scanner', 'history', 'sheet']

const viewFromHash = () => {
  const v = window.location.hash.replace('#', '')
  return VIEWS.includes(v) ? v : 'home'
}

export default function App() {
  const [view, setViewState] = useState(viewFromHash)
  const [scans, setScans] = useState(loadScans)
  const [selectedId, setSelectedId] = useState(null)
  const [navOpen, setNavOpen] = useState(false)
  const [sheetFocus, setSheetFocus] = useState(null)

  useEffect(() => {
    saveScans(scans)
  }, [scans])

  // The current screen lives in the URL hash, so the browser/phone back button works.
  useEffect(() => {
    const onHash = () => {
      setViewState(viewFromHash())
      setNavOpen(false)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view])

  const setView = (next) => {
    window.location.hash = next === 'home' ? '' : next
  }

  const addScan = (scan) => setScans((prev) => [scan, ...prev])
  const updateScan = (id, patch) => setScans((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const deleteScans = (ids) => {
    const gone = new Set(ids)
    setScans((prev) => prev.filter((s) => !gone.has(s.id)))
    if (gone.has(selectedId)) setSelectedId(null)
  }
  const addBlankRow = () => {
    const scan = {
      id: makeId(),
      serial: '',
      name: '',
      model: '',
      color: '',
      location: '',
      note: '',
      source: 'manual',
      scannedAt: new Date().toISOString(),
    }
    addScan(scan)
    return scan.id
  }

  const openItem = (id) => {
    setSelectedId(id)
    setNavOpen(false)
  }
  const openInSheet = (id) => {
    setSelectedId(null)
    setSheetFocus({ id, at: makeId() })
    setView('sheet')
  }

  const selected = scans.find((s) => s.id === selectedId) ?? null

  let content
  if (view === 'scanner') {
    content = <Scanner scans={scans} onSave={addScan} onBack={() => setView('home')} onHistory={() => setView('history')} />
  } else if (view === 'history') {
    content = <History scans={scans} onDelete={(id) => deleteScans([id])} onOpen={openItem} onScan={() => setView('scanner')} />
  } else if (view === 'sheet') {
    content = (
      <Spreadsheet
        key={sheetFocus?.at ?? 'sheet'}
        scans={scans}
        focusId={sheetFocus?.id}
        onUpdate={updateScan}
        onAddRow={addBlankRow}
        onDeleteMany={deleteScans}
        onOpenItem={openItem}
      />
    )
  } else {
    content = (
      <Dashboard
        scans={scans}
        onScan={() => setView('scanner')}
        onSheet={() => setView('sheet')}
        onHistory={() => setView('history')}
        onOpen={openItem}
      />
    )
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[18.5rem_minmax(0,1fr)]">
      <a
        href="#main-content"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main-content')?.focus()
        }}
        className="sr-only z-50 rounded-md bg-card px-3 py-2 font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <Sidebar
        scans={scans}
        view={view}
        selectedId={selectedId}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        onNavigate={(v) => {
          setNavOpen(false)
          setView(v)
        }}
        onOpenItem={openItem}
      />

      <div className="flex min-w-0 flex-col lg:h-dvh">
        {view !== 'scanner' && (
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur lg:hidden">
            <Button variant="ghost" size="icon" aria-label="Open menu" aria-expanded={navOpen} onClick={() => setNavOpen(true)}>
              <Menu className="size-5!" />
            </Button>
            <span className="flex-1 truncate font-semibold">IT Stock Scanner</span>
            <Button size="sm" onClick={() => setView('scanner')}>
              <ScanText aria-hidden="true" />
              Scan
            </Button>
          </header>
        )}
        <div id="main-content" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
          {content}
        </div>
      </div>

      {selected && (
        <ItemDrawer
          key={selected.id}
          scan={selected}
          onClose={() => setSelectedId(null)}
          onUpdate={updateScan}
          onDelete={(id) => deleteScans([id])}
          onShowInSheet={openInSheet}
        />
      )}
    </div>
  )
}

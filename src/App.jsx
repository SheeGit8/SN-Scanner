import { useEffect, useRef, useState } from 'react'
import { MobileNav, Sidebar } from './components/Sidebar.jsx'
import Dashboard from './components/Home.jsx'
import Scanner from './components/Scanner.jsx'
import PhotoCapture from './components/PhotoCapture.jsx'
import History from './components/History.jsx'
import Spreadsheet from './components/Spreadsheet.jsx'
import ItemDrawer from './components/ItemDrawer.jsx'
import { FirstLoad } from './components/SyncStatus.jsx'
import LoginScreen from './components/Login.jsx'
import { ConfirmDialog, ToastProvider } from './components/ui.jsx'
import { makeId } from './storage.js'
import { stock, useStock } from './stock.js'
import { DRAFT_PAGES, drafts } from './drafts.js'
import { isRemote } from './lib/api.js'
import { useTheme } from './lib/theme.js'
import { useToast } from './lib/toast.js'
import { cn } from './lib/utils.js'

const VIEWS = ['home', 'scanner', 'photo', 'history', 'sheet']

const viewFromHash = () => {
  const v = window.location.hash.replace('#', '')
  return VIEWS.includes(v) ? v : 'home'
}

export default function App() {
  return (
    <ToastProvider>
      <Gate />
    </ToastProvider>
  )
}

/** With the Google Sheet connected, nothing opens until someone logs in with the app password. */
function Gate() {
  const snap = useStock()
  return snap.state === 'locked' ? <LoginScreen snap={snap} /> : <Shell />
}

function Shell() {
  const [view, setViewState] = useState(viewFromHash)
  const snap = useStock()
  const { scans } = snap
  const [selectedId, setSelectedId] = useState(null)
  const [navOpen, setNavOpen] = useState(false)
  const [sheetFocus, setSheetFocus] = useState(null)
  const [dark, toggleTheme] = useTheme()
  const mainRef = useRef(null)
  const toast = useToast()

  const [confirmLogout, setConfirmLogout] = useState(false)
  const logout = () => {
    setConfirmLogout(false)
    toast('Logged out.')
    stock.logout() // the login screen takes over
  }
  // Changes that haven't reached the sheet yet are kept for the next login, but say so first.
  const requestLogout = () => (snap.pending ? setConfirmLogout(true) : logout())

  useEffect(() => {
    stock.setNotify((message, type) => toast(message, type ? { type } : undefined))
  }, [toast])

  // The current screen lives in the URL hash, so the browser/phone back button works.
  useEffect(() => {
    const onHash = () => {
      setViewState(viewFromHash())
      setNavOpen(false)
      window.scrollTo({ top: 0 })
      // Move focus to the new page for keyboard and screen reader users.
      requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }))
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // An item was being added when the app was refreshed or closed: go back to its page, which reopens
  // it. Opening the Scanner or Photo page directly stays there; each page restores its own draft.
  useEffect(() => {
    const page = drafts.latestPage()
    if (page && !DRAFT_PAGES.includes(viewFromHash())) window.location.hash = page
  }, [])

  const setView = (next) => {
    window.location.hash = next === 'home' ? '' : next
  }

  const addScan = (scan) => stock.add(scan)
  const updateScan = (id, patch) => stock.update(id, patch)
  const deleteScans = (ids) => {
    stock.remove(ids)
    if (ids.includes(selectedId)) setSelectedId(null)
  }
  const addBlankRow = () => {
    const scan = {
      id: makeId(),
      serial: '',
      name: '',
      user: '',
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
  // Until the sheet's list has loaded once on this device, the list screens wait for it. Scanning works.
  const waiting = snap.mode === 'remote' && !snap.loaded && !['scanner', 'photo'].includes(view)
  const isSheet = view === 'sheet' && !waiting

  let content
  if (waiting) {
    content = <FirstLoad snap={snap} />
  } else if (view === 'scanner') {
    content = <Scanner scans={scans} onSave={addScan} onHistory={() => setView('history')} />
  } else if (view === 'photo') {
    content = <PhotoCapture scans={scans} onSave={addScan} onHistory={() => setView('history')} />
  } else if (view === 'history') {
    content = <History scans={scans} onDelete={(id) => deleteScans([id])} onOpen={openItem} onScan={() => setView('scanner')} />
  } else if (isSheet) {
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
        onPhoto={() => setView('photo')}
        onSheet={() => setView('sheet')}
        onHistory={() => setView('history')}
        onOpen={openItem}
      />
    )
  }

  const navProps = {
    scans,
    view,
    selectedId,
    onNavigate: (v) => setView(v),
    onOpenItem: openItem,
    dark,
    onToggleTheme: toggleTheme,
    sync: snap,
    onLogout: isRemote ? requestLogout : undefined,
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          mainRef.current?.focus()
        }}
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <Sidebar {...navProps} />
      <MobileNav {...navProps} open={navOpen} onOpenChange={setNavOpen} onScan={() => setView('scanner')} />

      <div className="flex flex-1 flex-col md:pl-64">
        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          className={cn(
            'outline-none',
            isSheet
              ? // The sheet fills the window under the 56 px mobile top bar, and scrolls inside itself.
                'flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col md:h-dvh'
              : 'mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6',
          )}
        >
          {content}
        </main>

        {!isSheet && (
          <footer className="border-t">
            <div className="mx-auto max-w-6xl px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground sm:px-6">
              {isRemote
                ? 'Sheehan IT Stock Scanner · the stock list is shared through the team’s Google Sheet. Changes made offline are sent when you’re back online.'
                : 'Sheehan IT Stock Scanner · scans are saved in this browser on this device. Export a CSV to keep a copy.'}
            </div>
          </footer>
        )}
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

      <ConfirmDialog
        open={confirmLogout}
        title="Log out with unsaved changes?"
        description={`${snap.pending === 1 ? '1 change hasn’t' : `${snap.pending} changes haven’t`} reached the Google Sheet yet. They stay on this device and are saved the next time someone logs in here.`}
        cancelLabel="Stay logged in"
        confirmLabel="Log out"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={logout}
      />
    </div>
  )
}

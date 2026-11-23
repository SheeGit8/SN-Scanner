import { useState } from 'react'

// Same key as the inline script in index.html, which applies the theme before first paint.
const THEME_KEY = 'sn-theme'

/** Light/dark theme. The first visit follows the OS; the toggle's choice is saved on this device. */
export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light')
    } catch {
      // Private mode or storage full: the theme still applies for this visit.
    }
    setDark(next)
  }
  return [dark, toggle]
}

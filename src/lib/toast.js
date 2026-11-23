import { createContext, useContext } from 'react'

/**
 * toast(message, { type: 'success' | 'error' | 'info', duration })
 * Error toasts stay until dismissed unless a duration is given.
 */
export const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

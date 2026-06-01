/**
 * Toast Store — ephemeral notifications for the operator.
 */
import { create } from 'zustand'

export type ToastType = 'info' | 'warning' | 'critical' | 'success'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  actionLabel?: string
  action?: () => void
  duration?: number
}

interface ToastStore {
  toasts: Toast[]
  addToast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  clearAll: () => void
}

let toastId = 0

export const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],
  addToast: (t) => {
    const id = `toast-${++toastId}-${Date.now()}`
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
    if (t.duration !== 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
      }, t.duration ?? 6000)
    }
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearAll: () => set({ toasts: [] }),
}))

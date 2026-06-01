/**
 * Toast System — slide-in notifications for alerts, actions, and status.
 */
import { useToastStore } from '../store/toastStore'

const TYPE_COLOR: Record<string, { border: string; bg: string }> = {
  info:     { border: 'rgba(88,166,255,0.4)', bg: 'rgba(88,166,255,0.08)' },
  warning:  { border: 'rgba(251,140,0,0.4)',  bg: 'rgba(251,140,0,0.08)' },
  critical: { border: 'rgba(229,57,53,0.5)',  bg: 'rgba(229,57,53,0.10)' },
  success:  { border: 'rgba(139,195,74,0.4)',  bg: 'rgba(139,195,74,0.08)' },
}

export function ToastSystem() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="toast-system">
      {toasts.map((t) => {
        const style = TYPE_COLOR[t.type] ?? TYPE_COLOR.info
        return (
          <div
            key={t.id}
            className={`toast toast--${t.type}`}
            style={{ borderColor: style.border, background: style.bg }}
          >
            <div className="toast-content">
              <span className="toast-title">{t.title}</span>
              {t.message && <span className="toast-message">{t.message}</span>}
              {t.actionLabel && t.action && (
                <button className="toast-action" onClick={() => { t.action!(); dismiss(t.id) }}>
                  {t.actionLabel}
                </button>
              )}
            </div>
            <button className="toast-dismiss" onClick={() => dismiss(t.id)}>✕</button>
          </div>
        )
      })}
    </div>
  )
}

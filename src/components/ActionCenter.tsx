import { useEffect, useState } from 'react'
import { subscribeToActions, updateActionStatus, type DraftAction } from '../lib/db'
import { trackEvent } from '../lib/firebase'

interface Props {
  onClose: () => void
}

export function ActionCenter({ onClose }: Props) {
  const [actions, setActions] = useState<DraftAction[]>([])

  useEffect(() => {
    trackEvent('open_action_center')
    const unsubscribe = subscribeToActions((newActions) => {
      setActions(newActions)
    })
    return () => unsubscribe()
  }, [])

  const handleAction = async (id: string, status: 'approved' | 'dismissed') => {
    trackEvent('resolve_action', { action_id: id, status })
    await updateActionStatus(id, status)
  }

  return (
    <div className="action-center-panel" role="dialog" aria-modal="true" aria-labelledby="action-center-title">
      <div className="action-center-header">
        <div>
          <h2 id="action-center-title" className="action-center-title">GLOBAL SITREP</h2>
          <div className="action-center-subtitle">
            {actions.length} PENDING ACTION{actions.length !== 1 ? 'S' : ''}
          </div>
        </div>
        <button className="action-center-close" onClick={onClose} aria-label="Close Action Center">
          ✕
        </button>
      </div>

      <div className="action-center-content">
        {actions.length === 0 ? (
          <div className="action-center-empty">
            <span className="action-center-empty-icon">✓</span>
            <p>NO PENDING ACTIONS</p>
            <span>City operations are nominal.</span>
          </div>
        ) : (
          <ul className="action-center-list">
            {actions.map(action => (
              <li key={action.id} className="action-card">
                <div className="action-card-header">
                  <span className="action-card-district">{action.district.toUpperCase()}</span>
                  <span className="action-card-time">
                    {new Date(action.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="action-card-body">
                  <pre className="action-card-text">{action.text}</pre>
                </div>
                <div className="action-card-footer">
                  <button 
                    className="action-btn action-btn-dismiss" 
                    onClick={() => handleAction(action.id, 'dismissed')}
                  >
                    DISMISS
                  </button>
                  <button 
                    className="action-btn action-btn-approve" 
                    onClick={() => handleAction(action.id, 'approved')}
                  >
                    APPROVE
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

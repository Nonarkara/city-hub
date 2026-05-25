import { useEffect, useState } from 'react'
import { searchBangkokDatasets, type DataGoItem } from '../data/datago'

export function DataFeedPanel() {
  const [items, setItems] = useState<DataGoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    searchBangkokDatasets()
      .then((res) => setItems(res))
      .finally(() => setLoading(false))
  }, [])

  return (
    <aside className={`feed-panel ${collapsed ? 'feed-panel--collapsed' : ''}`}>
      <div className="feed-header" onClick={() => setCollapsed((v) => !v)}>
        <span className="feed-title">data.go.th · BKK</span>
        <span className="feed-count">{items.length}</span>
        <span className="feed-chevron">{collapsed ? '▴' : '▾'}</span>
      </div>
      {!collapsed && (
        <div className="feed-list">
          {loading && <div className="feed-empty">LOADING…</div>}
          {!loading && items.length === 0 && (
            <div className="feed-empty">
              NO DATASETS FOUND
              <br />
              <a
                href="https://data.go.th/search?q=กรุงเทพ"
                target="_blank"
                rel="noopener noreferrer"
                className="feed-empty-link"
              >
                OPEN DATA.GO.TH →
              </a>
            </div>
          )}
          {!loading && items.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="feed-item"
              title={item.notes}
            >
              <div className="feed-item-title">{item.title}</div>
              <div className="feed-item-meta">
                <span className="feed-item-org">{item.organization}</span>
                {item.format && <span className="feed-item-format">{item.format}</span>}
              </div>
            </a>
          ))}
        </div>
      )}
    </aside>
  )
}

/**
 * DataFeedPanel — dual-source open-data browser.
 *
 *   Tab 1: data.go.th — national portal (~10k datasets, Bangkok-filtered)
 *   Tab 2: data.bangkok.go.th — BMA portal (~1,431 BMA-specific datasets)
 *
 * The BMA portal is what gets called "BMA OPEN DATA" in the layer catalog —
 * it's the canonical source for drainage, traffic, parks, public works,
 * citizen services data that the city itself publishes.
 */
import { useEffect, useState } from 'react'
import { searchBangkokDatasets, type DataGoItem } from '../data/datago'
import { searchBMADatasets, bmaDatasetCount, type BMADataItem } from '../data/datago-bma'

type Tab = 'national' | 'bma'

export function DataFeedPanel() {
  const [tab, setTab] = useState<Tab>('bma')
  const [nationalItems, setNationalItems] = useState<DataGoItem[]>([])
  const [bmaItems, setBmaItems] = useState<BMADataItem[]>([])
  const [bmaTotal, setBmaTotal] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    Promise.all([
      searchBangkokDatasets().then((r) => setNationalItems(r)).catch(() => {}),
      searchBMADatasets().then((r) => setBmaItems(r)).catch(() => {}),
      bmaDatasetCount().then((n) => setBmaTotal(n)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const items = tab === 'national' ? nationalItems : bmaItems
  const countLabel = tab === 'national' ? nationalItems.length : bmaTotal || bmaItems.length
  const portalHref = tab === 'national'
    ? 'https://data.go.th/search?q=กรุงเทพ'
    : 'https://data.bangkok.go.th/dataset'

  return (
    <aside className={`feed-panel ${collapsed ? 'feed-panel--collapsed' : ''}`}>
      <div className="feed-header" onClick={() => setCollapsed((v) => !v)}>
        <span className="feed-title">OPEN DATA · BKK</span>
        <span className="feed-count">{countLabel}</span>
        <span className="feed-chevron">{collapsed ? '▴' : '▾'}</span>
      </div>
      {!collapsed && (
        <>
          <div className="feed-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'bma'}
              className={`feed-tab ${tab === 'bma' ? 'active' : ''}`}
              onClick={() => setTab('bma')}
            >
              BMA · {bmaTotal || '—'}
            </button>
            <button
              role="tab"
              aria-selected={tab === 'national'}
              className={`feed-tab ${tab === 'national' ? 'active' : ''}`}
              onClick={() => setTab('national')}
            >
              NATIONAL
            </button>
          </div>
          <div className="feed-list">
            {loading && <div className="feed-empty">LOADING…</div>}
            {!loading && items.length === 0 && (
              <div className="feed-empty">
                NO DATASETS
                <br />
                <a
                  href={portalHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="feed-empty-link"
                >
                  OPEN PORTAL →
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
        </>
      )}
    </aside>
  )
}

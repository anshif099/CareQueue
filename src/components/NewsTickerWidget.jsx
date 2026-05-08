import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchLiveMalayalamHeadlines } from '../services/newsService.js'

const TICKER_REFRESH_MS = 2 * 60 * 1000
const HEADLINE_DISPLAY_MS = 6000
const INDEX_STORAGE_KEY = 'carequeue-ticker-index'

function getStoredIndex() {
  try {
    return Number(sessionStorage.getItem(INDEX_STORAGE_KEY)) || 0
  } catch {
    return 0
  }
}

function NewsTickerWidget() {
  const [headlines, setHeadlines] = useState([])
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [activeIndex, setActiveIndex] = useState(getStoredIndex)
  const [animState, setAnimState] = useState('in')
  const rotateTimerRef = useRef(null)

  useEffect(() => {
    let isMounted = true

    async function loadHeadlines() {
      const nextHeadlines = await fetchLiveMalayalamHeadlines()
      if (!isMounted) return

      if (nextHeadlines.length > 0) {
        setHeadlines(nextHeadlines)
        setLastUpdatedAt(Date.now())
      }
    }

    loadHeadlines()
    const refreshTimer = window.setInterval(loadHeadlines, TICKER_REFRESH_MS)

    return () => {
      isMounted = false
      window.clearInterval(refreshTimer)
    }
  }, [])

  const tickerItems = useMemo(() => {
    if (headlines.length === 0) {
      return ['ലൈവ് വാര്‍ത്തകള്‍ ലോഡ് ചെയ്യുന്നു...']
    }
    return headlines
  }, [headlines])

  const advance = useCallback(() => {
    // Start exit animation
    setAnimState('out')

    // After exit animation finishes, switch headline + enter
    setTimeout(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % tickerItems.length
        try { sessionStorage.setItem(INDEX_STORAGE_KEY, String(next)) } catch { /* */ }
        return next
      })
      setAnimState('in')
    }, 600)
  }, [tickerItems.length])

  useEffect(() => {
    if (tickerItems.length <= 1) return

    rotateTimerRef.current = window.setInterval(advance, HEADLINE_DISPLAY_MS)

    return () => {
      if (rotateTimerRef.current) window.clearInterval(rotateTimerRef.current)
    }
  }, [advance, tickerItems.length])

  // Clamp index if headlines changed
  const safeIndex = activeIndex % tickerItems.length
  const currentHeadline = tickerItems[safeIndex] || tickerItems[0]
  const headlineNumber = headlines.length > 0 ? safeIndex + 1 : null

  return (
    <footer className="tv-ticker" aria-label="Live Malayalam news headlines">
      <div className="tv-ticker-label">
        <span>BREAKING</span>
        <strong>LIVE NEWS</strong>
      </div>
      <div className="tv-ticker-track">
        <div className={`tv-ticker-headline tv-ticker-headline--${animState}`} key={safeIndex}>
          {headlineNumber && <em className="tv-ticker-num">{headlineNumber}</em>}
          <span>{currentHeadline}</span>
        </div>
      </div>
      <div className="tv-ticker-time">
        {lastUpdatedAt ? 'LIVE' : 'SYNC'}
      </div>
    </footer>
  )
}

export default NewsTickerWidget

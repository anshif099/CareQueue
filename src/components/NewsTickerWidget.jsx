import { useEffect, useMemo, useState } from 'react'
import { fetchLiveMalayalamHeadlines } from '../services/newsService.js'

const TICKER_REFRESH_MS = 2 * 60 * 1000

function NewsTickerWidget() {
  const [headlines, setHeadlines] = useState([])
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)

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

  return (
    <footer className="tv-ticker" aria-label="Live Malayalam news headlines">
      <div className="tv-ticker-label">
        <span>BREAKING</span>
        <strong>LIVE NEWS</strong>
      </div>
      <div className="tv-ticker-track">
        <div className="tv-ticker-content">
          {[...tickerItems, ...tickerItems].map((headline, index) => (
            <span key={`${headline}-${index}`}>{headline}</span>
          ))}
        </div>
      </div>
      <div className="tv-ticker-time">
        {lastUpdatedAt ? 'LIVE' : 'SYNC'}
      </div>
    </footer>
  )
}

export default NewsTickerWidget

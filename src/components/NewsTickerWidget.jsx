import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchLiveMalayalamHeadlines } from '../services/newsService.js'

const BATCH_SIZE = 10

function NewsTickerWidget() {
  const [allHeadlines, setAllHeadlines] = useState([])
  const [batchIndex, setBatchIndex] = useState(0)
  const [animKey, setAnimKey] = useState(0)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const fetchingRef = useRef(false)

  const loadHeadlines = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const headlines = await fetchLiveMalayalamHeadlines()
      if (headlines.length > 0) {
        setAllHeadlines(headlines)
        setLastUpdatedAt(Date.now())
      }
    } finally {
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    loadHeadlines()
  }, [loadHeadlines])

  const currentBatch = useMemo(() => {
    if (allHeadlines.length === 0) {
      return ['ലൈവ് വാര്‍ത്തകള്‍ ലോഡ് ചെയ്യുന്നു...']
    }
    const start = (batchIndex * BATCH_SIZE) % allHeadlines.length
    const batch = []
    for (let i = 0; i < BATCH_SIZE && i < allHeadlines.length; i++) {
      batch.push(allHeadlines[(start + i) % allHeadlines.length])
    }
    return batch
  }, [allHeadlines, batchIndex])

  function handleAnimationEnd() {
    const nextBatch = batchIndex + 1
    const nextStart = nextBatch * BATCH_SIZE

    if (nextStart >= allHeadlines.length) {
      // All batches shown — fetch fresh headlines & restart
      setBatchIndex(0)
      loadHeadlines()
    } else {
      setBatchIndex(nextBatch)
    }

    // Re-trigger animation
    setAnimKey((prev) => prev + 1)
  }

  return (
    <footer className="tv-ticker" aria-label="Live Malayalam news headlines">
      <div className="tv-ticker-label">
        <span>BREAKING</span>
        <strong>LIVE NEWS</strong>
      </div>
      <div className="tv-ticker-track">
        <div
          className="tv-ticker-content"
          key={animKey}
          onAnimationEnd={handleAnimationEnd}
        >
          {currentBatch.map((headline, index) => (
            <span key={index}>{headline}</span>
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

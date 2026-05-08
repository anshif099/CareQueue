const GOOGLE_NEWS_RSS_URL = 'https://news.google.com/rss/search?q=Kerala&hl=ml&gl=IN&ceid=IN:ml'
const CACHE_KEY = 'carequeue-news-v2'
const CACHE_MAX_AGE_MS = 5 * 60 * 1000

function decodeHtmlEntities(value) {
  const textArea = document.createElement('textarea')
  textArea.innerHTML = value
  return textArea.value
}

function cleanHeadline(value) {
  return decodeHtmlEntities(value)
    .replace(/\s+/g, ' ')
    .replace(/\s*[-–|]\s*[A-Za-z].*$/g, '')
    .trim()
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.headlines) || !parsed.savedAt) return null
    // Only use cache if it's less than 5 minutes old
    if (Date.now() - parsed.savedAt > CACHE_MAX_AGE_MS) return null
    return parsed.headlines
  } catch {
    return null
  }
}

function writeCache(headlines) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ headlines, savedAt: Date.now() }))
    // Clean up old cache key from previous version
    localStorage.removeItem('carequeue-live-news-headlines')
  } catch { /* */ }
}

async function fetchFromApi() {
  const response = await fetch('/api/news-headlines?t=' + Date.now(), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`)
  }

  const data = await response.json()
  if (!Array.isArray(data.headlines)) throw new Error('Invalid API response')
  return data.headlines.map(cleanHeadline).filter(Boolean)
}

function extractHeadlinesFromRss(xml) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')
  const items = Array.from(doc.querySelectorAll('item'))
  const headlines = items
    .map((item) => cleanHeadline(item.querySelector('title')?.textContent || ''))
    .filter((headline) => /[\u0D00-\u0D7F]/.test(headline))
    .filter((headline) => headline.length > 12)

  return Array.from(new Set(headlines)).slice(0, 20)
}

async function fetchFromRssDirect() {
  const response = await fetch(GOOGLE_NEWS_RSS_URL, {
    headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`RSS responded with ${response.status}`)
  }

  return extractHeadlinesFromRss(await response.text())
}

async function fetchLiveMalayalamHeadlines() {
  // 1. Try our server-side API first (bypasses CORS, most reliable)
  try {
    const headlines = await fetchFromApi()
    if (headlines.length > 0) {
      writeCache(headlines)
      return headlines
    }
  } catch {
    // API unavailable, try fallbacks
  }

  // 2. Try fetching RSS directly in browser (may be CORS blocked)
  try {
    const headlines = await fetchFromRssDirect()
    if (headlines.length > 0) {
      writeCache(headlines)
      return headlines
    }
  } catch {
    // CORS blocked or network error
  }

  // 3. Last resort: use cache only if it's recent (< 5 min old)
  const cached = readCache()
  if (cached && cached.length > 0) {
    return cached
  }

  return []
}

export {
  GOOGLE_NEWS_RSS_URL,
  fetchLiveMalayalamHeadlines,
}

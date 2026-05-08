const GOOGLE_NEWS_RSS_URL = 'https://news.google.com/rss/search?q=Kerala&hl=ml&gl=IN&ceid=IN:ml'

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

async function fetchOfficialHeadlines() {
  const response = await fetch('/api/news-headlines', {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error('Unable to load latest news headlines.')
  }

  const data = await response.json()
  return Array.isArray(data.headlines) ? data.headlines.map(cleanHeadline).filter(Boolean) : []
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

async function fetchRssDirectly() {
  const response = await fetch(GOOGLE_NEWS_RSS_URL, {
    headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
  })

  if (!response.ok) {
    throw new Error('Unable to load Google News RSS.')
  }

  return extractHeadlinesFromRss(await response.text())
}

async function fetchLiveMalayalamHeadlines() {
  let cachedHeadlines

  try {
    cachedHeadlines = JSON.parse(localStorage.getItem('carequeue-live-news-headlines') || '[]')
  } catch {
    cachedHeadlines = []
  }

  try {
    const headlines = await fetchOfficialHeadlines()
    if (headlines.length > 0) {
      localStorage.setItem('carequeue-live-news-headlines', JSON.stringify(headlines))
      return headlines
    }
  } catch {
    // Continue to direct RSS fetch fallback.
  }

  try {
    const headlines = await fetchRssDirectly()
    if (headlines.length > 0) {
      localStorage.setItem('carequeue-live-news-headlines', JSON.stringify(headlines))
      return headlines
    }
  } catch {
    // Browser CORS may block direct RSS reads; fall back to cached headlines.
  }

  return cachedHeadlines
}

export {
  GOOGLE_NEWS_RSS_URL,
  fetchLiveMalayalamHeadlines,
}

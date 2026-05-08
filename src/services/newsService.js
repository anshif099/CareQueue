const TWENTYFOUR_LIVE_URL = 'https://www.twentyfournews.com/live'
const YOUTUBE_LIVE_URL = 'https://www.youtube.com/watch?v=1wECsnGZcfc'

function decodeHtmlEntities(value) {
  const textArea = document.createElement('textarea')
  textArea.innerHTML = value
  return textArea.value
}

function cleanHeadline(value) {
  return decodeHtmlEntities(value)
    .replace(/\s+/g, ' ')
    .replace(/\s+\|.*$/g, '')
    .trim()
}

function extractHeadlinesFromHtml(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const latestNewsHeading = Array.from(doc.querySelectorAll('h1, h2, h3, h4, a, span'))
    .find((node) => node.textContent?.trim().toLowerCase() === 'latest news')
  const sourceRoot = latestNewsHeading?.parentElement || doc.body
  const anchors = Array.from(sourceRoot.querySelectorAll('a'))
  const headlines = anchors
    .map((anchor) => cleanHeadline(anchor.textContent || anchor.getAttribute('title') || ''))
    .filter((headline) => /[\u0D00-\u0D7F]/.test(headline))
    .filter((headline) => headline.length > 18)

  return Array.from(new Set(headlines)).slice(0, 12)
}

function extractYouTubeVideoId(url) {
  try {
    const parsedUrl = new URL(url)
    if (parsedUrl.hostname.includes('youtu.be')) {
      return parsedUrl.pathname.replace('/', '')
    }
    if (parsedUrl.searchParams.has('v')) {
      return parsedUrl.searchParams.get('v')
    }
    const embedMatch = parsedUrl.pathname.match(/\/(embed|live)\/([^/?]+)/)
    return embedMatch?.[2] || ''
  } catch {
    return ''
  }
}

async function fetchOfficialHeadlines() {
  const response = await fetch('/api/news-headlines', {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error('Unable to load latest 24 News headlines.')
  }

  const data = await response.json()
  return Array.isArray(data.headlines) ? data.headlines.map(cleanHeadline).filter(Boolean) : []
}

async function fetchHeadlinesDirectly() {
  const response = await fetch(TWENTYFOUR_LIVE_URL, {
    headers: { Accept: 'text/html' },
  })

  if (!response.ok) {
    throw new Error('Unable to load 24 News live page.')
  }

  return extractHeadlinesFromHtml(await response.text())
}

async function fetchYouTubeTitle() {
  const response = await fetch(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(YOUTUBE_LIVE_URL)}`,
    { headers: { Accept: 'application/json' } },
  )

  if (!response.ok) {
    throw new Error('Unable to load YouTube live metadata.')
  }

  const data = await response.json()
  return data.title ? [cleanHeadline(data.title)] : []
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
    // Continue to direct and metadata fallbacks. These still use official 24 News / YouTube sources.
  }

  try {
    const headlines = await fetchHeadlinesDirectly()
    if (headlines.length > 0) {
      localStorage.setItem('carequeue-live-news-headlines', JSON.stringify(headlines))
      return headlines
    }
  } catch {
    // Browser CORS can block direct news-site reads; keep going to official YouTube metadata.
  }

  try {
    const headlines = await fetchYouTubeTitle()
    if (headlines.length > 0) {
      return headlines
    }
  } catch {
    // The caller can keep the last official cached headlines or show a source status message.
  }

  return cachedHeadlines
}

export {
  TWENTYFOUR_LIVE_URL,
  YOUTUBE_LIVE_URL,
  extractYouTubeVideoId,
  fetchLiveMalayalamHeadlines,
}

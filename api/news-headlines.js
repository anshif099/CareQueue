// Google News top headlines + Kerala-specific news in Malayalam
const RSS_FEEDS = [
  'https://news.google.com/rss?hl=ml&gl=IN&ceid=IN:ml',
  'https://news.google.com/rss/search?q=Kerala+OR+%E0%B4%95%E0%B5%87%E0%B4%B0%E0%B4%B3%E0%B4%82&hl=ml&gl=IN&ceid=IN:ml',
]

function cleanHeadline(value) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .replace(/\s*[-–|]\s*[A-Za-z].*$/g, '')
    .trim()
}

function extractHeadlinesFromRss(xml) {
  const titleMatches = Array.from(xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<\/item>/gi))
  const headlines = titleMatches
    .map((match) => cleanHeadline(match[1]))
    .filter((headline) => /[\u0D00-\u0D7F]/.test(headline))
    .filter((headline) => headline.length > 12)

  return headlines
}

function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (request.method === 'OPTIONS') {
    response.status(204).end()
    return
  }

  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    // Fetch from multiple RSS feeds in parallel for more variety
    const results = await Promise.allSettled(
      RSS_FEEDS.map(async (feedUrl) => {
        const res = await fetch(feedUrl, {
          headers: {
            Accept: 'application/rss+xml, application/xml, text/xml',
            'User-Agent': 'CareQueue-TV/1.0',
          },
        })
        if (!res.ok) throw new Error(`RSS ${res.status}`)
        return extractHeadlinesFromRss(await res.text())
      })
    )

    // Merge headlines from all feeds, deduplicate, shuffle
    const allHeadlines = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value)

    const unique = Array.from(new Set(allHeadlines))
    const headlines = shuffleArray(unique).slice(0, 25)

    if (headlines.length === 0) {
      throw new Error('No headlines found from any feed')
    }

    // Short cache so headlines stay fresh
    response.setHeader('Cache-Control', 'public, s-maxage=45, stale-while-revalidate=30')
    response.status(200).json({
      headlines,
      source: 'Google News Malayalam',
      count: headlines.length,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    response.status(502).json({
      error: error.message || 'Unable to fetch news headlines',
      headlines: [],
    })
  }
}

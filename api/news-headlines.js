const GOOGLE_NEWS_RSS_URL = 'https://news.google.com/rss/search?q=Kerala&hl=ml&gl=IN&ceid=IN:ml'

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

  return Array.from(new Set(headlines)).slice(0, 20)
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
    const rssUrl = `${GOOGLE_NEWS_RSS_URL}&_t=${Math.floor(Date.now() / 60000)}`
    const sourceResponse = await fetch(rssUrl, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'CareQueue-TV/1.0',
      },
    })

    if (!sourceResponse.ok) {
      throw new Error(`Google News RSS responded with ${sourceResponse.status}`)
    }

    const headlines = extractHeadlinesFromRss(await sourceResponse.text())
    response.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=60')
    response.status(200).json({
      headlines,
      source: 'Google News Malayalam',
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    response.status(502).json({
      error: error.message || 'Unable to fetch news headlines',
      headlines: [],
      source: GOOGLE_NEWS_RSS_URL,
    })
  }
}

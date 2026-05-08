const SOURCE_URL = 'https://www.twentyfournews.com/live'

function decodeHtmlEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function stripTags(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
}

function cleanHeadline(value) {
  return decodeHtmlEntities(stripTags(value))
    .replace(/\s+/g, ' ')
    .trim()
}

function extractHeadlines(html) {
  const latestIndex = html.toLowerCase().indexOf('latest news')
  const latestSection = latestIndex >= 0 ? html.slice(latestIndex, latestIndex + 30000) : html
  const anchorMatches = Array.from(latestSection.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi))
  const headlines = anchorMatches
    .map((match) => cleanHeadline(match[1]))
    .filter((headline) => /[\u0D00-\u0D7F]/.test(headline))
    .filter((headline) => headline.length > 18)

  return Array.from(new Set(headlines)).slice(0, 16)
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
    const sourceResponse = await fetch(SOURCE_URL, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'CareQueue-TV/1.0 (+https://www.twentyfournews.com/live)',
      },
    })

    if (!sourceResponse.ok) {
      throw new Error(`Twentyfour News responded with ${sourceResponse.status}`)
    }

    const headlines = extractHeadlines(await sourceResponse.text())
    response.setHeader('Cache-Control', 'public, s-maxage=90, stale-while-revalidate=120')
    response.status(200).json({
      headlines,
      source: SOURCE_URL,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    response.status(502).json({
      error: error.message || 'Unable to fetch 24 News headlines',
      headlines: [],
      source: SOURCE_URL,
    })
  }
}

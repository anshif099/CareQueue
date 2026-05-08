import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const rssFeedUrls = [
  'https://news.google.com/rss?hl=ml&gl=IN&ceid=IN:ml',
  'https://news.google.com/rss/search?q=Kerala+OR+%E0%B4%95%E0%B5%87%E0%B4%B0%E0%B4%B3%E0%B4%82&hl=ml&gl=IN&ceid=IN:ml',
]

function cleanHeadline(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
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
  return titleMatches
    .map((match) => cleanHeadline(match[1]))
    .filter((headline) => /[\u0D00-\u0D7F]/.test(headline))
    .filter((headline) => headline.length > 12)
}

function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function liveNewsDevApi() {
  return {
    name: 'carequeue-live-news-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/news-headlines', async (_request, response) => {
        try {
          const results = await Promise.allSettled(
            rssFeedUrls.map(async (feedUrl) => {
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

          const allHeadlines = results
            .filter((r) => r.status === 'fulfilled')
            .flatMap((r) => r.value)

          const unique = Array.from(new Set(allHeadlines))
          const headlines = shuffleArray(unique).slice(0, 25)

          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({
            headlines,
            source: 'Google News Malayalam',
            count: headlines.length,
            updatedAt: new Date().toISOString(),
          }))
        } catch (error) {
          response.statusCode = 502
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({
            error: error.message || 'Unable to fetch news headlines',
            headlines: [],
          }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), liveNewsDevApi()],
})

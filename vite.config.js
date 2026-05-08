import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const googleNewsRssUrl = 'https://news.google.com/rss/search?q=Kerala&hl=ml&gl=IN&ceid=IN:ml'

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
  const headlines = titleMatches
    .map((match) => cleanHeadline(match[1]))
    .filter((headline) => /[\u0D00-\u0D7F]/.test(headline))
    .filter((headline) => headline.length > 12)

  return Array.from(new Set(headlines)).slice(0, 20)
}

function liveNewsDevApi() {
  return {
    name: 'carequeue-live-news-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/news-headlines', async (_request, response) => {
        try {
          const sourceResponse = await fetch(googleNewsRssUrl, {
            headers: {
              Accept: 'application/rss+xml, application/xml, text/xml',
              'User-Agent': 'CareQueue-TV/1.0',
            },
          })

          if (!sourceResponse.ok) {
            throw new Error(`Google News RSS responded with ${sourceResponse.status}`)
          }

          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({
            headlines: extractHeadlinesFromRss(await sourceResponse.text()),
            source: 'Google News Malayalam',
            updatedAt: new Date().toISOString(),
          }))
        } catch (error) {
          response.statusCode = 502
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({
            error: error.message || 'Unable to fetch news headlines',
            headlines: [],
            source: googleNewsRssUrl,
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

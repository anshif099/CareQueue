import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const newsSourceUrl = 'https://www.twentyfournews.com/live'

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

function cleanHeadline(value) {
  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function extractHeadlines(html) {
  const latestIndex = html.toLowerCase().indexOf('latest news')
  const latestSection = latestIndex >= 0 ? html.slice(latestIndex, latestIndex + 30000) : html
  const headlines = Array.from(latestSection.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => cleanHeadline(match[1]))
    .filter((headline) => /[\u0D00-\u0D7F]/.test(headline))
    .filter((headline) => headline.length > 18)

  return Array.from(new Set(headlines)).slice(0, 16)
}

function liveNewsDevApi() {
  return {
    name: 'carequeue-live-news-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/news-headlines', async (_request, response) => {
        try {
          const sourceResponse = await fetch(newsSourceUrl, {
            headers: {
              Accept: 'text/html,application/xhtml+xml',
              'User-Agent': 'CareQueue-TV/1.0 (+https://www.twentyfournews.com/live)',
            },
          })

          if (!sourceResponse.ok) {
            throw new Error(`Twentyfour News responded with ${sourceResponse.status}`)
          }

          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({
            headlines: extractHeadlines(await sourceResponse.text()),
            source: newsSourceUrl,
            updatedAt: new Date().toISOString(),
          }))
        } catch (error) {
          response.statusCode = 502
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({
            error: error.message || 'Unable to fetch 24 News headlines',
            headlines: [],
            source: newsSourceUrl,
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

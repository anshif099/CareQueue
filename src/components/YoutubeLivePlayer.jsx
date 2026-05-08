import { useEffect, useMemo, useState } from 'react'

const YOUTUBE_LIVE_URL = 'https://www.youtube.com/watch?v=1wECsnGZcfc'

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

function YoutubeLivePlayer({ streamUrl = YOUTUBE_LIVE_URL }) {
  const [playerKey, setPlayerKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const videoId = useMemo(() => extractYouTubeVideoId(streamUrl), [streamUrl])
  const embedUrl = useMemo(() => {
    const params = new URLSearchParams({
      autoplay: '1',
      controls: '0',
      disablekb: '1',
      enablejsapi: '1',
      fs: '0',
      iv_load_policy: '3',
      modestbranding: '1',
      mute: '1',
      playsinline: '1',
      rel: '0',
    })

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
  }, [videoId])

  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      setIsLoading(true)
      setPlayerKey((currentKey) => currentKey + 1)
    }, 10 * 60 * 1000)

    const handleOnline = () => {
      setIsLoading(true)
      setPlayerKey((currentKey) => currentKey + 1)
    }

    window.addEventListener('online', handleOnline)
    return () => {
      window.clearInterval(refreshTimer)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (!videoId) {
    return (
      <div className="tv-news-player-error">
        Official 24 News live stream is unavailable.
      </div>
    )
  }

  return (
    <section className="tv-news-player" aria-label="24 News Malayalam live stream">
      {isLoading && (
        <div className="tv-player-loading">
          <span />
          <strong>Loading 24 News Live</strong>
        </div>
      )}
      <div className="tv-channel-bug">
        <span>LIVE</span>
        <strong>24 NEWS</strong>
      </div>
      <iframe
        allow="autoplay; encrypted-media; picture-in-picture; web-share"
        allowFullScreen={false}
        className="tv-news-iframe"
        key={`${videoId}-${playerKey}`}
        onLoad={() => setIsLoading(false)}
        referrerPolicy="strict-origin-when-cross-origin"
        src={embedUrl}
        title="24 News Malayalam Live TV"
      />
    </section>
  )
}

export default YoutubeLivePlayer

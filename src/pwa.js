export function registerServiceWorker() {
  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  const canRegister = 'serviceWorker' in navigator && (window.isSecureContext || isLocalhost)

  if (!canRegister) {
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

export function enableImmersiveFullscreen() {
  if (!document.fullscreenEnabled || document.fullscreenElement) {
    return
  }

  const requestFullscreen = () => {
    document.documentElement
      .requestFullscreen({ navigationUI: 'hide' })
      .catch(() => {})
      .finally(() => {
        window.removeEventListener('pointerdown', requestFullscreen)
      })
  }

  window.addEventListener('pointerdown', requestFullscreen, { once: true })
}

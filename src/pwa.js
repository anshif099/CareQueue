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

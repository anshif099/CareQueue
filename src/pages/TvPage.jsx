import { useEffect, useMemo, useState } from 'react'
import { onValue, ref as databaseRef } from 'firebase/database'
import { database } from '../lib/firebase.jsx'
import NewsTickerWidget from '../components/NewsTickerWidget.jsx'
import '../components/TvDashboard.css'

const doctorSessionKey = 'carequeue-doctor-id'

function getDeviceTime() {
  const parts = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).formatToParts(new Date())

  const hour = parts.find((part) => part.type === 'hour')?.value ?? '12'
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'
  const second = parts.find((part) => part.type === 'second')?.value ?? '00'
  const dayPeriod = parts.find((part) => part.type === 'dayPeriod')?.value ?? 'am'
  
  return { time: `${hour}:${minute}:${second}`, period: dayPeriod.toLowerCase() }
}

function getDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function mapDoctors(snapshot) {
  const doctors = snapshot.val()
  if (!doctors) return []
  return Object.entries(doctors).map(([id, doctor]) => ({ id, ...doctor }))
}

function mapAppointments(snapshot) {
  const appointments = snapshot.val()
  if (!appointments) return []
  return Object.entries(appointments).map(([id, appointment]) => ({ id, ...appointment }))
}

function isActiveAppointment(appointment) {
  const status = String(appointment?.status ?? 'waiting').toLowerCase()
  return !['completed', 'done', 'cancelled', 'canceled', 'skipped', 'no-show'].includes(status)
}

function compareAppointments(firstAppointment, secondAppointment) {
  const firstSequence = Number(firstAppointment.sequence) || Number.MAX_SAFE_INTEGER
  const secondSequence = Number(secondAppointment.sequence) || Number.MAX_SAFE_INTEGER

  if (firstSequence !== secondSequence) {
    return firstSequence - secondSequence
  }
  return (Number(firstAppointment.createdAt) || 0) - (Number(secondAppointment.createdAt) || 0)
}

function extractYouTubeVideoId(url) {
  try {
    if (!url) return ''
    const parsedUrl = new URL(url)
    if (parsedUrl.hostname.includes('youtu.be')) {
      return parsedUrl.pathname.replace('/', '')
    }
    if (parsedUrl.searchParams.has('v')) {
      return parsedUrl.searchParams.get('v')
    }
    const pathMatch = parsedUrl.pathname.match(/\/(embed|live|shorts)\/([^/?]+)/)
    if (pathMatch) {
      return pathMatch[2]
    }
    return ''
  } catch {
    return ''
  }
}

function getDoctorCounter(doctor) {
  if (doctor?.counter) return doctor.counter
  if (doctor?.counterName) return doctor.counterName
  return 'Counter 1'
}

function useTvDisplayMode() {
  useEffect(() => {
    let wakeLock = null

    async function enableDisplayMode() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen')
        }
      } catch {
        wakeLock = null
      }

      try {
        await screen.orientation?.lock?.('landscape')
      } catch {
        // Orientation locking is best-effort and may require installed PWA/fullscreen mode.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        enableDisplayMode()
      }
    }

    enableDisplayMode()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      wakeLock?.release?.()
    }
  }, [])
}

function TvPage() {
  const [doctors, setDoctors] = useState([])
  const [appointments, setAppointments] = useState([])
  const [loginId, setLoginId] = useState('')
  const [doctorId, setDoctorId] = useState(() => sessionStorage.getItem(doctorSessionKey) || '')
  const [error, setError] = useState('')
  const [dataError, setDataError] = useState('')
  const [isDoctorsLoading, setIsDoctorsLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(getDeviceTime())
  const [tvAd, setTvAd] = useState(null)

  useTvDisplayMode()

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(getDeviceTime())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const unsubscribe = onValue(
      databaseRef(database, 'doctors'),
      (snapshot) => {
        setDoctors(mapDoctors(snapshot))
        setIsDoctorsLoading(false)
        setDataError('')
      },
      (firebaseError) => {
        setDataError(firebaseError.message)
        setIsDoctorsLoading(false)
      },
    )
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = onValue(databaseRef(database, 'appointments'), (snapshot) => {
      setAppointments(mapAppointments(snapshot))
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = onValue(databaseRef(database, 'settings/tvAd'), (snapshot) => {
      setTvAd(snapshot.val())
    })
    return unsubscribe
  }, [])

  function handleLogin(event) {
    event.preventDefault()
    const normalizedLogin = loginId.trim().toLowerCase()
    const matchedDoctor = doctors.find(
      (currentDoctor) => String(currentDoctor.loginId ?? '').trim().toLowerCase() === normalizedLogin,
    )

    if (!matchedDoctor) {
      setError('Doctor login ID not found')
      return
    }

    sessionStorage.setItem(doctorSessionKey, matchedDoctor.id)
    setDoctorId(matchedDoctor.id)
    setError('')
  }

  const todayKey = getDateKey(new Date())

  // Process data for the TV screen
  const mainDoctor = doctors.find(d => d.id === doctorId)
  
  const allActiveAppointments = useMemo(() => {
    return appointments
      .filter((app) => app.dateKey === todayKey && isActiveAppointment(app))
      .sort(compareAppointments)
  }, [appointments, todayKey])

  const mainDoctorQueue = useMemo(() => {
    if (!mainDoctor) return []
    return allActiveAppointments.filter(app => app.doctorId === mainDoctor.id)
  }, [allActiveAppointments, mainDoctor])

  const mainInConsult = useMemo(() => {
    return mainDoctorQueue.find(app => ['in_consult', 'serving'].includes(String(app.status ?? '').toLowerCase())) || null
  }, [mainDoctorQueue])

  const mainCurrentPatient = mainInConsult || mainDoctorQueue[0] || null

  const adYouTubeId = useMemo(() => {
    if (tvAd?.type === 'video' && tvAd?.url) {
      return extractYouTubeVideoId(tvAd.url)
    }
    return ''
  }, [tvAd])

  const activeCounters = useMemo(() => {
    return doctors.filter(d => (d.status ?? 'Consulting') === 'Consulting' || d.servingToken).map(d => {
      const dQueue = allActiveAppointments.filter(app => app.doctorId === d.id)
      const inCons = dQueue.find(app => ['in_consult', 'serving'].includes(String(app.status ?? '').toLowerCase()))
      const curr = inCons || dQueue[0] || null
      return {
        id: d.id,
        name: d.name,
        department: d.department,
        counter: getDoctorCounter(d),
        token: curr?.token || d.servingToken || '--',
        status: d.status || 'Consulting'
      }
    })
  }, [doctors, allActiveAppointments])

  if (!doctorId || (!mainDoctor && !isDoctorsLoading)) {
    return (
      <main className="tv-login-page">
        <form className="tv-login-card" onSubmit={handleLogin}>
          <div>
            <p>TV Display</p>
            <h1>Select Doctor</h1>
            <span>Enter the doctor login ID to configure this screen.</span>
          </div>
          <label>
            Doctor login ID
            <input
              autoComplete="username"
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              placeholder="rajan-opd"
            />
          </label>
          {(error || dataError) && <p className="tv-login-error">{error || dataError}</p>}
          <button disabled={isDoctorsLoading} type="submit">
            {isDoctorsLoading ? 'Loading...' : 'Start TV Display'}
          </button>
        </form>
      </main>
    )
  }

  if (!mainDoctor) {
    return <main className="tv-console tv-console-loading">Loading TV display...</main>
  }

  return (
    <main className="tv-console">
      <header className="tv-header">
        <div className="tv-logo-area">
          <div className="tv-logo-icon">+</div>
          <div className="tv-logo-text">
            <h1>CareQueue · City Health Clinic</h1>
            <p>Outpatient Department</p>
          </div>
        </div>
        <div className="tv-header-right">
          <div className="tv-live-badge"><span className="tv-dot"></span> LIVE</div>
          <div className="tv-time">
            {currentTime.time} <span>{currentTime.period}</span>
          </div>
        </div>
      </header>

      <div className="tv-main-grid">
        <div className="tv-left-panel">
          <section className="tv-serving-section">
            <h2 className="tv-section-title">NOW SERVING</h2>
            <div className="tv-serving-display">
              <div 
                className="tv-huge-token" 
                data-empty={!(mainCurrentPatient?.token || mainDoctor.servingToken)}
              >
                {mainCurrentPatient?.token || mainDoctor.servingToken || 'WAITING'}
              </div>
              <div className="tv-serving-details">
                <span className="tv-pill">{getDoctorCounter(mainDoctor)}</span>
                <span className="tv-dept-text">{mainDoctor.department} — Consultation</span>
              </div>
              <div className="tv-serving-doctor">{mainDoctor.name}</div>
            </div>
          </section>

          <section className="tv-counters-section">
            <h2 className="tv-section-title">COUNTER STATUS</h2>
            <div className="tv-counters-grid">
              {activeCounters.slice(0, 6).map(counter => (
                <div className="tv-counter-card" key={counter.id}>
                  <span>{counter.counter}</span>
                  <strong>{counter.token}</strong>
                  <em data-status={counter.status === 'Consulting' ? 'open' : 'closed'}>
                    {counter.status === 'Consulting' ? 'Open' : counter.status}
                  </em>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="tv-right-panel">
          {tvAd?.url ? (
            tvAd.type === 'video' ? (
              adYouTubeId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${adYouTubeId}?autoplay=1&mute=1&loop=1&playlist=${adYouTubeId}&controls=0&modestbranding=1&iv_load_policy=3&rel=0`}
                  allow="autoplay; encrypted-media"
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    border: 'none',
                    transform: 'scale(1.1)', // Slight scale to hide YouTube edges if needed
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <video 
                  key={tvAd.url}
                  src={tvAd.url} 
                  autoPlay 
                  loop 
                  muted 
                  playsInline 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )
            ) : (
              <img src={tvAd.url} alt="Advertisement" />
            )
          ) : (
            <div className="tv-ad-empty">
              <h2>Ad Space</h2>
              <p>Configure in Super Admin panel</p>
            </div>
          )}
        </div>
      </div>

      <NewsTickerWidget />
    </main>
  )
}

export default TvPage

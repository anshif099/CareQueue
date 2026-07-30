import { useEffect, useMemo, useState } from 'react'
import { onValue, ref as databaseRef } from 'firebase/database'
import { database } from '../lib/firebase.jsx'
import {
  DEFAULT_HOSPITAL,
  getDoctorHospitalId,
  isDoctorAvailableNow,
  mapHospitals,
  TV_DOCTOR_ROTATION_MS,
} from '../lib/tvDisplay.js'
import NewsTickerWidget from '../components/NewsTickerWidget.jsx'
import '../components/TvDashboard.css'

const hospitalSessionKey = 'carequeue-tv-hospital-id'

function getDeviceTime(date) {
  const parts = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).formatToParts(date)

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
  return Object.entries(doctors).map(([id, doctor]) => ({ ...doctor, id }))
}

function mapAppointments(snapshot) {
  const appointments = snapshot.val()
  if (!appointments) return []
  return Object.entries(appointments).map(([id, appointment]) => ({ ...appointment, id }))
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
  const [hospitals, setHospitals] = useState([DEFAULT_HOSPITAL])
  const [doctors, setDoctors] = useState([])
  const [appointments, setAppointments] = useState([])
  const [hospitalLoginId, setHospitalLoginId] = useState('')
  const [hospitalId, setHospitalId] = useState(
    () => sessionStorage.getItem(hospitalSessionKey) || '',
  )
  const [activeDoctorId, setActiveDoctorId] = useState('')
  const [error, setError] = useState('')
  const [doctorsError, setDoctorsError] = useState('')
  const [appointmentsError, setAppointmentsError] = useState('')
  const [isHospitalsLoading, setIsHospitalsLoading] = useState(true)
  const [isDoctorsLoading, setIsDoctorsLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [tvAds, setTvAds] = useState([])
  const [cachedActiveAd] = useState(() => {
    try {
      const cached = localStorage.getItem('carequeue-active-ad')
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })

  useTvDisplayMode()

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentDate(new Date())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const unsubscribe = onValue(
      databaseRef(database, 'hospitals'),
      (snapshot) => {
        setHospitals(mapHospitals(snapshot.val()))
        setIsHospitalsLoading(false)
      },
      () => {
        setIsHospitalsLoading(false)
      },
    )
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = onValue(
      databaseRef(database, 'doctors'),
      (snapshot) => {
        setDoctors(mapDoctors(snapshot))
        setIsDoctorsLoading(false)
        setDoctorsError('')
      },
      (firebaseError) => {
        setDoctorsError(firebaseError.message)
        setIsDoctorsLoading(false)
      },
    )
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = onValue(
      databaseRef(database, 'appointments'),
      (snapshot) => {
        setAppointments(mapAppointments(snapshot))
        setAppointmentsError('')
      },
      (firebaseError) => {
        setAppointmentsError(firebaseError.message)
      },
    )
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = onValue(databaseRef(database, 'settings/tvAds'), (snapshot) => {
      const data = snapshot.val()
      if (data) {
        setTvAds(Object.entries(data).map(([id, ad]) => ({ id, ...ad })))
      } else {
        setTvAds([])
      }
    })
    return unsubscribe
  }, [])

  const activeAd = useMemo(() => {
    const scheduled = [...tvAds]
      .filter((ad) => new Date(ad.scheduledAt) <= currentDate)
      .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt))

    return scheduled[0] || cachedActiveAd
  }, [cachedActiveAd, currentDate, tvAds])

  useEffect(() => {
    if (!activeAd) {
      return
    }

    try {
      localStorage.setItem('carequeue-active-ad', JSON.stringify(activeAd))
    } catch {
      // The live ad still works when local storage is unavailable.
    }
  }, [activeAd])

  function handleLogin(event) {
    event.preventDefault()
    const enteredHospitalId = hospitalLoginId.trim()
    const matchedHospital = hospitals.find(
      (hospital) => String(hospital.id).trim() === enteredHospitalId,
    )
    const hasHospitalDoctors = doctors.some(
      (doctor) => getDoctorHospitalId(doctor) === enteredHospitalId,
    )

    if (!enteredHospitalId || (!matchedHospital && !hasHospitalDoctors)) {
      setError('Hospital ID not found')
      return
    }

    const nextHospitalId = matchedHospital?.id || enteredHospitalId
    sessionStorage.setItem(hospitalSessionKey, nextHospitalId)
    setHospitalId(nextHospitalId)
    setActiveDoctorId('')
    setError('')
  }

  function handleChangeHospital() {
    sessionStorage.removeItem(hospitalSessionKey)
    setHospitalId('')
    setHospitalLoginId('')
    setActiveDoctorId('')
    setError('')
  }

  const currentTime = getDeviceTime(currentDate)
  const currentMinute = Math.floor(currentDate.getTime() / 60_000)
  const todayKey = getDateKey(currentDate)

  const selectedHospital = useMemo(() => {
    const storedHospital = hospitals.find((hospital) => hospital.id === hospitalId)

    if (storedHospital) {
      return storedHospital
    }

    const hasHospitalDoctors = doctors.some(
      (doctor) => getDoctorHospitalId(doctor) === hospitalId,
    )

    if (hospitalId && !isHospitalsLoading && hasHospitalDoctors) {
      return {
        id: hospitalId,
        name: hospitalId,
        location: 'Outpatient Department',
      }
    }

    return null
  }, [doctors, hospitalId, hospitals, isHospitalsLoading])

  useEffect(() => {
    if (hospitalId && !isHospitalsLoading && !isDoctorsLoading && !selectedHospital) {
      sessionStorage.removeItem(hospitalSessionKey)
    }
  }, [hospitalId, isDoctorsLoading, isHospitalsLoading, selectedHospital])

  const hospitalDoctors = useMemo(() => {
    if (!selectedHospital) {
      return []
    }

    return doctors.filter((doctor) => getDoctorHospitalId(doctor) === selectedHospital.id)
  }, [doctors, selectedHospital])

  const activeConsultDoctorIds = useMemo(
    () =>
      new Set(
        appointments
          .filter(
            (appointment) =>
              appointment.dateKey === todayKey &&
              ['in_consult', 'serving'].includes(
                String(appointment.status ?? '').toLowerCase(),
              ),
          )
          .map((appointment) => appointment.doctorId),
      ),
    [appointments, todayKey],
  )

  const availableDoctors = useMemo(() => {
    const availabilityTime = new Date(currentMinute * 60_000)

    return hospitalDoctors
      .filter(
        (doctor) =>
          isDoctorAvailableNow(doctor, availabilityTime) || activeConsultDoctorIds.has(doctor.id),
      )
      .sort((firstDoctor, secondDoctor) =>
        getDoctorCounter(firstDoctor).localeCompare(getDoctorCounter(secondDoctor), undefined, {
          numeric: true,
        }),
      )
  }, [activeConsultDoctorIds, currentMinute, hospitalDoctors])

  const rotationDoctorIds = availableDoctors.map((doctor) => doctor.id).join('\u001f')

  useEffect(() => {
    const doctorIds = rotationDoctorIds ? rotationDoctorIds.split('\u001f') : []

    if (doctorIds.length < 2) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setActiveDoctorId((currentDoctorId) => {
        const storedIndex = doctorIds.indexOf(currentDoctorId)
        const visibleIndex = storedIndex >= 0 ? storedIndex : 0
        return doctorIds[(visibleIndex + 1) % doctorIds.length]
      })
    }, TV_DOCTOR_ROTATION_MS)

    return () => window.clearInterval(timer)
  }, [hospitalId, rotationDoctorIds])

  const mainDoctor =
    availableDoctors.find((doctor) => doctor.id === activeDoctorId) || availableDoctors[0] || null
  const mainDoctorPosition = mainDoctor
    ? availableDoctors.findIndex((doctor) => doctor.id === mainDoctor.id) + 1
    : 0
  const hospitalDoctorIds = useMemo(
    () => new Set(hospitalDoctors.map((doctor) => doctor.id)),
    [hospitalDoctors],
  )

  const allActiveAppointments = useMemo(() => {
    return appointments
      .filter(
        (appointment) =>
          hospitalDoctorIds.has(appointment.doctorId) &&
          appointment.dateKey === todayKey &&
          isActiveAppointment(appointment),
      )
      .sort(compareAppointments)
  }, [appointments, hospitalDoctorIds, todayKey])

  const mainDoctorQueue = useMemo(() => {
    if (!mainDoctor) return []
    return allActiveAppointments.filter(app => app.doctorId === mainDoctor.id)
  }, [allActiveAppointments, mainDoctor])

  const mainInConsult = useMemo(() => {
    return mainDoctorQueue.find(app => ['in_consult', 'serving'].includes(String(app.status ?? '').toLowerCase())) || null
  }, [mainDoctorQueue])

  const mainCurrentPatient = mainInConsult || mainDoctorQueue[0] || null

  const adYouTubeId = useMemo(() => {
    if (activeAd?.type === 'video' && activeAd?.url) {
      return extractYouTubeVideoId(activeAd.url)
    }
    return ''
  }, [activeAd])

  const activeCounters = useMemo(() => {
    return availableDoctors.map((doctor) => {
      const doctorQueue = allActiveAppointments.filter(
        (appointment) => appointment.doctorId === doctor.id,
      )
      const inConsult = doctorQueue.find((appointment) =>
        ['in_consult', 'serving'].includes(String(appointment.status ?? '').toLowerCase()),
      )
      const currentPatient = inConsult || doctorQueue[0] || null

      return {
        id: doctor.id,
        name: doctor.name,
        department: doctor.department,
        counter: getDoctorCounter(doctor),
        token: currentPatient?.token || doctor.servingToken || '--',
        status: doctor.status || 'Consulting',
      }
    })
  }, [allActiveAppointments, availableDoctors])

  if (hospitalId && !selectedHospital && isHospitalsLoading) {
    return <main className="tv-console tv-console-loading">Loading TV display...</main>
  }

  if (!hospitalId || !selectedHospital) {
    return (
      <main className="tv-login-page">
        <form className="tv-login-card" onSubmit={handleLogin}>
          <div>
            <p>TV Display</p>
            <h1>Connect Hospital</h1>
            <span>Enter the TV Hospital ID shown in the Super Admin hospital list.</span>
          </div>
          <label>
            Hospital ID
            <input
              autoComplete="username"
              value={hospitalLoginId}
              onChange={(event) => setHospitalLoginId(event.target.value)}
              placeholder="default-primary"
            />
          </label>
          {(error || doctorsError || appointmentsError) && (
            <p className="tv-login-error">
              {error || doctorsError || appointmentsError}
            </p>
          )}
          <button disabled={isHospitalsLoading || isDoctorsLoading} type="submit">
            {isHospitalsLoading || isDoctorsLoading ? 'Loading...' : 'Start TV Display'}
          </button>
        </form>
      </main>
    )
  }

  if (doctorsError || appointmentsError) {
    return (
      <main className="tv-login-page">
        <section className="tv-login-card tv-data-error-card">
          <div>
            <p>TV Display</p>
            <h1>Live data unavailable</h1>
            <span>{doctorsError || appointmentsError}</span>
          </div>
          <button type="button" onClick={() => window.location.reload()}>
            Retry
          </button>
          <button className="tv-secondary-button" type="button" onClick={handleChangeHospital}>
            Change hospital
          </button>
        </section>
      </main>
    )
  }

  if (isDoctorsLoading) {
    return <main className="tv-console tv-console-loading">Loading TV display...</main>
  }

  return (
    <main className="tv-console">
      <header className="tv-header">
        <div className="tv-logo-area">
          <div className="tv-logo-icon">+</div>
          <div className="tv-logo-text">
            <h1>CareQueue &middot; {selectedHospital.name || selectedHospital.id}</h1>
            <p>{selectedHospital.location || 'Outpatient Department'}</p>
          </div>
        </div>
        <div className="tv-header-right">
          <button className="tv-change-hospital" type="button" onClick={handleChangeHospital}>
            Change hospital
          </button>
          <div className="tv-live-badge"><span className="tv-dot"></span> LIVE</div>
          <div className="tv-time">
            {currentTime.time} <span>{currentTime.period}</span>
          </div>
        </div>
      </header>

      <div className="tv-main-grid">
        <div className="tv-left-panel">
          <section className="tv-serving-section">
            <div className="tv-section-heading">
              <h2 className="tv-section-title">NOW SERVING</h2>
              {availableDoctors.length > 1 && (
                <span>
                  Doctor {mainDoctorPosition} of {availableDoctors.length} &middot; next in 15 seconds
                </span>
              )}
            </div>
            {mainDoctor ? (
              <div className="tv-serving-display" key={mainDoctor.id}>
                <div
                  className="tv-huge-token"
                  data-empty={!(mainCurrentPatient?.token || mainDoctor.servingToken)}
                >
                  {mainCurrentPatient?.token || mainDoctor.servingToken || 'WAITING'}
                </div>
                <div className="tv-serving-details">
                  <span className="tv-pill">{getDoctorCounter(mainDoctor)}</span>
                  <span className="tv-dept-text">
                    {mainDoctor.department || 'General'} &mdash; Consultation
                  </span>
                </div>
                <div className="tv-serving-doctor">{mainDoctor.name || 'Doctor'}</div>
              </div>
            ) : (
              <div className="tv-no-doctors">
                <strong>No doctors available now</strong>
                <span>
                  Doctors will appear automatically when their consulting session starts.
                </span>
              </div>
            )}
          </section>

          <section className="tv-counters-section">
            <h2 className="tv-section-title">COUNTER STATUS</h2>
            <div className="tv-counters-grid">
              {activeCounters.slice(0, 6).map((counter) => (
                <div
                  className="tv-counter-card"
                  data-active={counter.id === mainDoctor?.id}
                  key={counter.id}
                >
                  <span>{counter.counter}</span>
                  <strong>{counter.token}</strong>
                  <em data-status="open">Open</em>
                </div>
              ))}
              {activeCounters.length === 0 && <p className="tv-empty-counters">No counters open</p>}
            </div>
          </section>
        </div>

        <div className="tv-right-panel">
          {activeAd?.url ? (
            activeAd.type === 'video' ? (
              adYouTubeId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${adYouTubeId}?autoplay=1&mute=1&loop=1&playlist=${adYouTubeId}&controls=0&modestbranding=1&iv_load_policy=3&rel=0`}
                  allow="autoplay; encrypted-media"
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    border: 'none',
                    objectFit: 'fill'
                  }}
                />
              ) : (
                <video 
                  key={activeAd.url}
                  src={activeAd.url} 
                  autoPlay 
                  loop 
                  muted 
                  playsInline 
                  style={{ width: '100%', height: '100%', objectFit: 'fill' }}
                  onLoadedData={() => {
                    // Optional: could signal "fully loaded" here if needed
                  }}
                />
              )
            ) : (
              <img src={activeAd.url} alt="Advertisement" />
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

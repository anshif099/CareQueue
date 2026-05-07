import { useEffect, useMemo, useState } from 'react'
import { onValue, ref as databaseRef, update } from 'firebase/database'
import { database } from '../lib/firebase.jsx'
import '../components/DoctorDashboard.css'

const doctorSessionKey = 'carequeue-doctor-id'
const quickMedicines = ['Paracetamol 500mg', 'Amoxicillin 500mg', 'Cetirizine 10mg', 'Omeprazole 20mg']

function getInitials(name) {
  return String(name ?? 'Doctor')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
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

  if (!doctors) {
    return []
  }

  return Object.entries(doctors).map(([id, doctor]) => ({ id, ...doctor }))
}

function mapAppointments(snapshot) {
  const appointments = snapshot.val()

  if (!appointments) {
    return []
  }

  return Object.entries(appointments).map(([id, appointment]) => ({ id, ...appointment }))
}

function isActiveAppointment(appointment) {
  const status = String(appointment?.status ?? 'waiting').toLowerCase()
  return !['completed', 'done', 'cancelled', 'canceled', 'skipped', 'no-show'].includes(status)
}

function compareAppointments(firstAppointment, secondAppointment) {
  const firstDelayed = String(firstAppointment.status ?? '').toLowerCase() === 'delayed' ? 1 : 0
  const secondDelayed = String(secondAppointment.status ?? '').toLowerCase() === 'delayed' ? 1 : 0
  const firstPriority = firstAppointment.priority ? 0 : 1
  const secondPriority = secondAppointment.priority ? 0 : 1

  if (firstDelayed !== secondDelayed) {
    return firstDelayed - secondDelayed
  }

  if (firstPriority !== secondPriority) {
    return firstPriority - secondPriority
  }

  const firstSequence = Number(firstAppointment.sequence) || Number.MAX_SAFE_INTEGER
  const secondSequence = Number(secondAppointment.sequence) || Number.MAX_SAFE_INTEGER

  if (firstSequence !== secondSequence) {
    return firstSequence - secondSequence
  }

  return (Number(firstAppointment.createdAt) || 0) - (Number(secondAppointment.createdAt) || 0)
}

function getAverageSlotMinutes(startTime, endTime, appointmentsPerDay) {
  if (!startTime || !endTime || !appointmentsPerDay) {
    return 15
  }

  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)
  const startTotal = startHour * 60 + startMinute
  let endTotal = endHour * 60 + endMinute

  if (endTotal <= startTotal) {
    endTotal += 24 * 60
  }

  return Math.max(5, Math.round((endTotal - startTotal) / Number(appointmentsPerDay)))
}

function formatTime12(time) {
  if (!time) {
    return '--'
  }

  const [hourValue, minute] = String(time).split(':').map(Number)
  const period = hourValue >= 12 ? 'PM' : 'AM'
  const hour = hourValue % 12 || 12
  return `${hour}:${String(minute || 0).padStart(2, '0')} ${period}`
}

function getSessionMinutes(doctor) {
  const startTime = doctor?.startTime

  if (!startTime) {
    return 0
  }

  const [hour, minute] = startTime.split(':').map(Number)
  const start = new Date()
  start.setHours(hour, minute, 0, 0)
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000))
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours <= 0) {
    return `${remainingMinutes}m`
  }

  return `${hours}h ${remainingMinutes}m`
}

function getElapsedText(appointment) {
  const startedAt = Number(appointment?.calledAt) || Number(appointment?.issuedAt) || 0

  if (!startedAt) {
    return '-- elapsed'
  }

  return `${formatDuration(Math.max(0, Math.floor((Date.now() - startedAt) / 60000)))} elapsed`
}

function getPatientName(appointment) {
  return appointment?.patientName || appointment?.patient || 'Patient'
}

function getAppointmentType(appointment) {
  return appointment?.slot ? 'Appt' : 'Walk-in'
}

function getVisitHistory(appointment) {
  return Array.isArray(appointment?.visitHistory) && appointment.visitHistory.length > 0
    ? appointment.visitHistory
    : ['No previous visits recorded']
}

function getStatusLabel(appointment) {
  const status = String(appointment?.status ?? 'waiting').toLowerCase()

  if (status === 'in_consult' || status === 'serving') {
    return 'In consult'
  }

  if (status === 'completed') {
    return 'Done'
  }

  if (appointment?.priority) {
    return 'Priority'
  }

  return status === 'waiting' ? 'Waiting' : status
}

function getDoctorQueueState(doctor, appointments) {
  const todayKey = getDateKey(new Date())
  const todayAppointments = appointments
    .filter((appointment) => appointment.doctorId === doctor?.id && appointment.dateKey === todayKey)
    .sort(compareAppointments)
  const activeQueue = todayAppointments.filter(isActiveAppointment)
  const inConsult =
    activeQueue.find((appointment) =>
      ['in_consult', 'serving'].includes(String(appointment.status ?? '').toLowerCase()),
    ) ?? null
  const currentPatient = inConsult ?? activeQueue[0] ?? null
  const upcomingQueue = activeQueue.filter((appointment) => appointment.id !== currentPatient?.id)
  const completedCount = todayAppointments.filter(
    (appointment) => String(appointment.status ?? '').toLowerCase() === 'completed',
  ).length

  return {
    activeQueue,
    completedCount,
    currentPatient,
    inConsult,
    todayAppointments,
    upcomingQueue,
  }
}

function DoctorPage() {
  const [doctors, setDoctors] = useState([])
  const [appointments, setAppointments] = useState([])
  const [loginId, setLoginId] = useState('')
  const [doctorId, setDoctorId] = useState(() => sessionStorage.getItem(doctorSessionKey) || '')
  const [error, setError] = useState('')
  const [dataError, setDataError] = useState('')
  const [isDoctorsLoading, setIsDoctorsLoading] = useState(true)
  const [prescription, setPrescription] = useState('')

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

  const doctor = useMemo(
    () => doctors.find((currentDoctor) => currentDoctor.id === doctorId),
    [doctorId, doctors],
  )
  const queueState = useMemo(() => getDoctorQueueState(doctor, appointments), [appointments, doctor])
  const avgConsultMinutes = getAverageSlotMinutes(
    doctor?.startTime,
    doctor?.endTime,
    doctor?.appointmentsPerDay,
  )
  const waitingCount = queueState.inConsult ? queueState.upcomingQueue.length : queueState.activeQueue.length
  const visibleQueue = queueState.inConsult ? queueState.upcomingQueue : queueState.activeQueue
  const nextAppointment = visibleQueue[0]

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

  function handleLogout() {
    sessionStorage.removeItem(doctorSessionKey)
    setDoctorId('')
    setLoginId('')
    setPrescription('')
  }

  async function updateCurrentAppointment(values) {
    if (!queueState.currentPatient?.id) {
      return
    }

    await update(databaseRef(database, `appointments/${queueState.currentPatient.id}`), values)
  }

  async function handleCallNext() {
    const nextPatient = queueState.inConsult ? queueState.upcomingQueue[0] : queueState.currentPatient

    if (!nextPatient?.id) {
      return
    }

    await update(databaseRef(database, `appointments/${nextPatient.id}`), {
      status: 'in_consult',
      calledAt: Date.now(),
    })
    await update(databaseRef(database, `doctors/${doctor.id}`), {
      currentToken: nextPatient.token,
      servingToken: nextPatient.token,
      status: 'Consulting',
    })
  }

  async function handleMarkComplete() {
    if (!queueState.currentPatient?.id) {
      return
    }

    await updateCurrentAppointment({
      status: 'completed',
      completedAt: Date.now(),
      prescription: prescription.trim(),
    })
    await update(databaseRef(database, `doctors/${doctor.id}`), {
      currentToken: queueState.upcomingQueue[0]?.token ?? '',
      servingToken: queueState.upcomingQueue[0]?.token ?? '',
    })
    setPrescription('')
  }

  async function handleSkip() {
    await updateCurrentAppointment({
      status: 'skipped',
      skippedAt: Date.now(),
    })
  }

  async function handleRecall() {
    await updateCurrentAppointment({
      status: 'in_consult',
      calledAt: Date.now(),
    })
  }

  async function handlePriority() {
    const nextPatient = queueState.upcomingQueue[0]

    if (!nextPatient?.id) {
      return
    }

    await update(databaseRef(database, `appointments/${nextPatient.id}`), {
      priority: true,
    })
  }

  async function handleDelay() {
    if (!queueState.currentPatient?.id) {
      return
    }

    await updateCurrentAppointment({
      status: 'delayed',
      delayedAt: Date.now(),
      sequence: (Number(queueState.currentPatient.sequence) || 0) + 1000,
    })
  }

  async function handleBreakToggle() {
    await update(databaseRef(database, `doctors/${doctor.id}`), {
      status: doctor?.status === 'On break' ? 'Consulting' : 'On break',
    })
  }

  async function handleSendPrescription() {
    await updateCurrentAppointment({
      prescription: prescription.trim(),
      prescriptionSentAt: Date.now(),
    })
  }

  if (!doctorId || (!doctor && !isDoctorsLoading)) {
    return (
      <main className="doctor-login-page">
        <form className="doctor-login-card" onSubmit={handleLogin}>
          <div>
            <p>Doctor console</p>
            <h1>Doctor login</h1>
            <span>Enter the login ID assigned in admin doctor management.</span>
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

          {(error || dataError) && <p className="doctor-login-error">{error || dataError}</p>}

          <button disabled={isDoctorsLoading} type="submit">
            {isDoctorsLoading ? 'Loading...' : 'Login'}
          </button>
        </form>
      </main>
    )
  }

  if (!doctor) {
    return <main className="doctor-console doctor-console-loading">Loading doctor dashboard...</main>
  }

  const currentPatient = queueState.currentPatient
  const status = doctor.status || 'Consulting'

  return (
    <main className="doctor-console">
      <header className="doctor-profile-card">
        <div className="doctor-page-avatar">{getInitials(doctor.name)}</div>
        <div className="doctor-profile-copy">
          <h1>{doctor.name}</h1>
          <p>
            {doctor.department} - {doctor.counter || 'Counter not set'}
          </p>
        </div>
        <div className="doctor-profile-actions">
          <span>Session: {formatDuration(getSessionMinutes(doctor))}</span>
          <em data-status={status}>{status}</em>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="doctor-stat-grid">
        <article>
          <span>Patients seen</span>
          <strong>{queueState.completedCount}</strong>
          <p>today</p>
        </article>
        <article>
          <span>Waiting</span>
          <strong>{waitingCount}</strong>
          <p>in my queue</p>
        </article>
        <article>
          <span>Avg consult</span>
          <strong>{avgConsultMinutes}m</strong>
          <p>today's avg</p>
        </article>
        <article>
          <span>Next appt</span>
          <strong>{formatTime12(nextAppointment?.slotValue)}</strong>
          <p>{nextAppointment ? getPatientName(nextAppointment) : 'No upcoming'}</p>
        </article>
      </section>

      <section className="doctor-current-card" data-empty={!currentPatient}>
        {currentPatient ? (
          <>
            <div className="doctor-current-header">
              <div className="doctor-page-avatar">{getInitials(getPatientName(currentPatient))}</div>
              <div>
                <h2>{getPatientName(currentPatient)}</h2>
                <p>
                  Token {currentPatient.token} - {getAppointmentType(currentPatient)}
                </p>
              </div>
              <div>
                <strong>{currentPatient.token}</strong>
                <span>{getElapsedText(currentPatient)}</span>
              </div>
            </div>

            <div className="doctor-vital-grid">
              <div>
                <strong>{currentPatient.bp || '--'}</strong>
                <span>BP (mmHg)</span>
              </div>
              <div>
                <strong>{currentPatient.temperature || '--'}</strong>
                <span>Temp (F)</span>
              </div>
              <div>
                <strong>{currentPatient.pulse || '--'}</strong>
                <span>Pulse</span>
              </div>
              <div>
                <strong>{currentPatient.spo2 || '--'}</strong>
                <span>SpO2</span>
              </div>
            </div>

            <div className="doctor-history">
              <span>Visit history</span>
              <div>
                {getVisitHistory(currentPatient).map((visit) => (
                  <em key={visit}>{visit}</em>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="doctor-current-empty">
            <h2>No active patient</h2>
            <p>Call the next patient when the queue is ready.</p>
          </div>
        )}
      </section>

      <section className="doctor-console-grid">
        <div className="doctor-actions-panel">
          <button type="button" onClick={handleCallNext} disabled={queueState.activeQueue.length === 0}>
            Call next patient
          </button>
          <button type="button" onClick={handleSkip} disabled={!currentPatient}>
            Skip (no-show)
          </button>
          <button type="button" onClick={handleRecall} disabled={!currentPatient}>
            Recall patient
          </button>
          <button type="button" onClick={handlePriority} disabled={queueState.upcomingQueue.length === 0}>
            Priority patient
          </button>
          <button type="button" onClick={handleDelay} disabled={!currentPatient}>
            Patient needs delay
          </button>
          <button type="button" onClick={handleMarkComplete} disabled={!currentPatient}>
            Mark complete
          </button>
          <button className="doctor-break-button" type="button" onClick={handleBreakToggle}>
            {status === 'On break' ? 'Resume consulting' : 'Go on break'}
          </button>

          <section className="doctor-queue-panel">
            <h2>Upcoming queue {visibleQueue.length} waiting</h2>
            {visibleQueue.length === 0 ? (
              <p>No upcoming patients.</p>
            ) : (
              visibleQueue.slice(0, 6).map((appointment, index) => (
                <div className="doctor-queue-row" key={appointment.id}>
                  <strong>{appointment.token}</strong>
                  <span>{getPatientName(appointment)}</span>
                  <em data-state={index < 2 ? 'next' : 'waiting'}>
                    {index === 0 ? 'Next' : index === 1 ? 'Soon' : 'Waiting'}
                  </em>
                </div>
              ))
            )}
          </section>
        </div>

        <div className="doctor-prescription-panel">
          <h2>Prescription</h2>
          <textarea
            value={prescription}
            onChange={(event) => setPrescription(event.target.value)}
            placeholder="Enter medicines, dosage, instructions... e.g. Paracetamol 500mg - 1 tab TDS x 5 days"
          ></textarea>
          <span>Quick add</span>
          <div className="doctor-quick-add">
            {quickMedicines.map((medicine) => (
              <button
                type="button"
                key={medicine}
                onClick={() =>
                  setPrescription((current) => `${current}${current ? '\n' : ''}${medicine}`)
                }
              >
                {medicine}
              </button>
            ))}
          </div>
          <div className="doctor-prescription-actions">
            <button type="button">Order lab test</button>
            <button type="button">Refer to specialist</button>
            <button type="button" onClick={handleSendPrescription} disabled={!currentPatient}>
              Send prescription
            </button>
          </div>
        </div>

        <div className="doctor-today-panel">
          <h2>Today's appointments</h2>
          {queueState.todayAppointments.length === 0 ? (
            <p>No appointments yet today.</p>
          ) : (
            <div className="doctor-today-list">
              {queueState.todayAppointments.map((appointment) => (
                <div className="doctor-today-row" key={appointment.id}>
                  <strong>{appointment.token}</strong>
                  <span>{getPatientName(appointment)}</span>
                  <span>{formatTime12(appointment.slotValue)}</span>
                  <em>{getStatusLabel(appointment)}</em>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

export default DoctorPage

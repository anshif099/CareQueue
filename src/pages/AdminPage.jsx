import { useEffect, useMemo, useState } from 'react'
import { onValue, push, ref as databaseRef, serverTimestamp, update, remove } from 'firebase/database'
import { database } from '../lib/firebase.jsx'
import '../components/AdminDashboard.css'

const adminCredentials = {
  username: 'admin',
  password: 'admin123',
}

const sidebarItems = ['Overview', 'Live queues', 'Doctors', 'Reports', 'Settings']

const queueRows = [
  { token: 'A014', patient: 'Maya R.', department: 'General', status: 'Waiting' },
  { token: 'B021', patient: 'Rahul N.', department: 'Dental', status: 'In room' },
  { token: 'C008', patient: 'Anu K.', department: 'Pediatrics', status: 'Ready' },
]

const emptyDoctorForm = {
  id: '',
  loginId: '',
  name: '',
  department: '',
  mobile: '',
  startHour: '9',
  startMinute: '00',
  startPeriod: 'AM',
  endHour: '5',
  endMinute: '00',
  endPeriod: 'PM',
  appointmentsPerDay: '',
  counter: '',
}

const hourOptions = Array.from({ length: 12 }, (_, index) => String(index + 1))
const minuteOptions = ['00', '15', '30', '45']

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function formatTimeRange(startTime, endTime) {
  if (!startTime || !endTime) {
    return 'Time not set'
  }

  return `${formatTime12(startTime)} - ${formatTime12(endTime)}`
}

function formatTime12(time) {
  const [hourValue, minute] = time.split(':').map(Number)
  const period = hourValue >= 12 ? 'PM' : 'AM'
  const hour = hourValue % 12 || 12
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`
}

function to24HourTime(hour, minute, period) {
  let hourValue = Number(hour) % 12

  if (period === 'PM') {
    hourValue += 12
  }

  return `${String(hourValue).padStart(2, '0')}:${minute}`
}

function getAverageSlot(startTime, endTime, appointmentsPerDay) {
  if (!startTime || !endTime || !appointmentsPerDay) {
    return '0m'
  }

  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)
  const startTotal = startHour * 60 + startMinute
  let endTotal = endHour * 60 + endMinute

  if (endTotal <= startTotal) {
    endTotal += 24 * 60
  }

  const slotMinutes = Math.max(1, Math.round((endTotal - startTotal) / appointmentsPerDay))
  return `${slotMinutes}m`
}

function getDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function mapAppointments(snapshot) {
  const appointments = snapshot.val()
  if (!appointments) return []
  return Object.entries(appointments).map(([id, appointment]) => ({ id, ...appointment }))
}

function mapDoctors(snapshot) {
  const doctors = snapshot.val()

  if (!doctors) {
    return []
  }

  return Object.entries(doctors)
    .map(([id, doctor]) => ({ id, ...doctor }))
    .sort((first, second) => (second.createdAt ?? 0) - (first.createdAt ?? 0))
}

function AdminPage() {
  const [isAuthed, setIsAuthed] = useState(() => sessionStorage.getItem('carequeue-admin') === '1')
  const [activeItem, setActiveItem] = useState('Overview')
  const [formData, setFormData] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [doctors, setDoctors] = useState([])
  const [isDoctorsLoading, setIsDoctorsLoading] = useState(true)
  const [doctorsError, setDoctorsError] = useState('')
  const [isDoctorFormOpen, setIsDoctorFormOpen] = useState(false)
  const [doctorForm, setDoctorForm] = useState(emptyDoctorForm)
  const [isSavingDoctor, setIsSavingDoctor] = useState(false)
  const [doctorFormError, setDoctorFormError] = useState('')
  const [appointments, setAppointments] = useState([])

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }).format(new Date()),
    [],
  )

  useEffect(() => {
    if (!isAuthed) {
      return undefined
    }

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

    const unsubscribeAppointments = onValue(
      databaseRef(database, 'appointments'),
      (snapshot) => {
        setAppointments(mapAppointments(snapshot))
      }
    )

    return () => {
      unsubscribe()
      unsubscribeAppointments()
    }
  }, [isAuthed])

  function handleLogin(event) {
    event.preventDefault()

    if (
      formData.username === adminCredentials.username &&
      formData.password === adminCredentials.password
    ) {
      sessionStorage.setItem('carequeue-admin', '1')
      setIsAuthed(true)
      setError('')
      return
    }

    setError('Invalid username or password')
  }

  function handleLogout() {
    sessionStorage.removeItem('carequeue-admin')
    setIsAuthed(false)
    setFormData({ username: '', password: '' })
  }

  function updateDoctorField(field, value) {
    setDoctorForm((current) => ({ ...current, [field]: value }))
  }

  async function handleDoctorDelete(id) {
    if (window.confirm('Are you sure you want to delete this doctor?')) {
      try {
        await remove(databaseRef(database, `doctors/${id}`))
      } catch (err) {
        setDoctorsError(err.message)
      }
    }
  }

  function handleDoctorEdit(doctor) {
    setDoctorForm({
      id: doctor.id,
      loginId: doctor.loginId || '',
      name: doctor.name || '',
      department: doctor.department || '',
      mobile: doctor.mobile || '',
      startHour: doctor.startTimeLabel?.split(':')[0] || '9',
      startMinute: doctor.startTimeLabel?.split(':')[1]?.split(' ')[0] || '00',
      startPeriod: doctor.startTimeLabel?.split(' ')[1] || 'AM',
      endHour: doctor.endTimeLabel?.split(':')[0] || '5',
      endMinute: doctor.endTimeLabel?.split(':')[1]?.split(' ')[0] || '00',
      endPeriod: doctor.endTimeLabel?.split(' ')[1] || 'PM',
      appointmentsPerDay: doctor.appointmentsPerDay || '',
      counter: doctor.counter || '',
    })
    setIsDoctorFormOpen(true)
  }

  async function handleDoctorSubmit(event) {
    event.preventDefault()
    setDoctorFormError('')
    setIsSavingDoctor(true)

    try {
      const appointmentsPerDay = Number(doctorForm.appointmentsPerDay)
      const loginId = doctorForm.loginId.trim()

      if (!Number.isFinite(appointmentsPerDay) || appointmentsPerDay <= 0) {
        throw new Error('Enter a valid number of appointments per day')
      }

      if (!loginId) {
        throw new Error('Enter a doctor login ID')
      }

      const duplicateLogin = doctors.find(
        (doctor) =>
          doctor.id !== doctorForm.id &&
          String(doctor.loginId ?? '').trim().toLowerCase() === loginId.toLowerCase(),
      )

      if (duplicateLogin) {
        throw new Error('This doctor login ID is already used')
      }

      const doctorData = {
        loginId,
        name: doctorForm.name.trim(),
        department: doctorForm.department.trim(),
        mobile: doctorForm.mobile.trim(),
        startTime: to24HourTime(
          doctorForm.startHour,
          doctorForm.startMinute,
          doctorForm.startPeriod,
        ),
        endTime: to24HourTime(doctorForm.endHour, doctorForm.endMinute, doctorForm.endPeriod),
        startTimeLabel: `${doctorForm.startHour}:${doctorForm.startMinute} ${doctorForm.startPeriod}`,
        endTimeLabel: `${doctorForm.endHour}:${doctorForm.endMinute} ${doctorForm.endPeriod}`,
        appointmentsPerDay,
        counter: doctorForm.counter ? doctorForm.counter.trim() : '',
        status: 'Consulting',
      }

      if (doctorForm.id) {
        await update(databaseRef(database, `doctors/${doctorForm.id}`), doctorData)
      } else {
        await push(databaseRef(database, 'doctors'), {
          ...doctorData,
          createdAt: serverTimestamp(),
        })
      }

      setDoctorForm(emptyDoctorForm)
      setIsDoctorFormOpen(false)
    } catch (submitError) {
      setDoctorFormError(submitError.message)
    } finally {
      setIsSavingDoctor(false)
    }
  }

  if (!isAuthed) {
    return (
      <main className="admin-login-page">
        <form className="admin-login-card" onSubmit={handleLogin}>
          <div>
            <p className="admin-login-eyebrow">ClinicAdmin</p>
            <h1>Admin access</h1>
            <p>Sign in to open the clinic dashboard.</p>
          </div>

          <label>
            Username
            <input
              autoComplete="username"
              value={formData.username}
              onChange={(event) =>
                setFormData((current) => ({ ...current, username: event.target.value }))
              }
            />
          </label>

          <label>
            Password
            <input
              autoComplete="current-password"
              type="password"
              value={formData.password}
              onChange={(event) =>
                setFormData((current) => ({ ...current, password: event.target.value }))
              }
            />
          </label>

          {error && <p className="admin-login-error">{error}</p>}

          <button type="submit">Login</button>
          <p className="admin-login-hint">Demo: admin / admin123</p>
        </form>
      </main>
    )
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-brand">
          Clinic<span>Admin</span>
        </div>

        <nav className="admin-nav">
          {sidebarItems.map((item) => (
            <button
              className="admin-nav-item"
              data-active={activeItem === item}
              key={item}
              type="button"
              onClick={() => setActiveItem(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="admin-profile">
          <strong>Dr. Admin</strong>
          <span>Clinic manager</span>
        </div>
      </aside>

      <section
        className={`admin-workspace ${activeItem === 'Doctors' ? 'admin-workspace-doctors' : ''}`}
      >
        {activeItem === 'Doctors' ? (
          <DoctorManagement
            doctorForm={doctorForm}
            doctorFormError={doctorFormError}
            doctors={doctors}
            appointments={appointments}
            doctorsError={doctorsError}
            isDoctorFormOpen={isDoctorFormOpen}
            isDoctorsLoading={isDoctorsLoading}
            isSavingDoctor={isSavingDoctor}
            onCloseForm={() => {
              setIsDoctorFormOpen(false)
              setDoctorFormError('')
              setDoctorForm(emptyDoctorForm)
            }}
            onOpenForm={() => {
              setDoctorForm(emptyDoctorForm)
              setIsDoctorFormOpen(true)
            }}
            onSubmit={handleDoctorSubmit}
            onUpdateField={updateDoctorField}
            onEditDoctor={handleDoctorEdit}
            onDeleteDoctor={handleDoctorDelete}
          />
        ) : activeItem === 'Live queues' ? (
          <LiveQueues 
            onLogout={handleLogout} 
            appointments={appointments}
            doctors={doctors}
          />
        ) : (
          <DashboardOverview 
            activeItem={activeItem} 
            onLogout={handleLogout} 
            today={today} 
            appointments={appointments}
            doctors={doctors}
          />
        )}
      </section>
    </main>
  )
}

function LiveQueues({ onLogout, appointments, doctors }) {
  const [currentTime, setCurrentTime] = useState(() => new Date())
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const todayKey = getDateKey(currentTime)
  const todayAppointments = useMemo(() => {
    return appointments.filter(a => a.dateKey === todayKey)
  }, [appointments, todayKey])

  const deptStats = {}
  
  doctors.forEach(doc => {
    if (doc.department) {
      if (!deptStats[doc.department]) {
        deptStats[doc.department] = {
          name: doc.department,
          waitCount: 0,
          totalToday: 0,
          completedCount: 0,
          totalWaitTime: 0,
          docs: new Set(),
          servingToken: '--',
          servingTokens: []
        }
      }
      deptStats[doc.department].docs.add(doc.id)
    }
  })
  
  todayAppointments.forEach(app => {
    const dept = app.department || 'Unknown'
    if (!deptStats[dept]) {
      deptStats[dept] = {
        name: dept,
        waitCount: 0,
        totalToday: 0,
        completedCount: 0,
        totalWaitTime: 0,
        docs: new Set(),
        servingToken: '--',
        servingTokens: []
      }
    }
    
    deptStats[dept].totalToday++
    if (app.doctorId) deptStats[dept].docs.add(app.doctorId)
    
    const status = String(app.status ?? '').toLowerCase()
    if (['completed', 'done'].includes(status)) {
      deptStats[dept].completedCount++
      if (app.calledAt && app.createdAt) {
        deptStats[dept].totalWaitTime += (app.calledAt - app.createdAt) / 60000
      }
    } else if (!['cancelled', 'canceled', 'skipped', 'no-show'].includes(status)) {
      if (['in_consult', 'serving', 'in room'].includes(status)) {
        deptStats[dept].servingTokens.push(app.token)
      } else {
        deptStats[dept].waitCount++
      }
    }
  })

  const deptCards = Object.values(deptStats).map((d, i) => {
    const avgWait = d.completedCount > 0 ? Math.round(d.totalWaitTime / d.completedCount) : 0
    const docCount = d.docs.size || 1
    const serving = d.servingTokens.length > 0 ? d.servingTokens[d.servingTokens.length - 1] : '--'
    
    const colors = ['#3b82f6', '#84cc16', '#8b5cf6', '#d97706', '#ea580c', '#be123c']
    const color = colors[i % colors.length]
    const percent = Math.max(5, Math.min(100, (d.completedCount / Math.max(1, d.totalToday)) * 100))

    return {
      name: d.name,
      serving,
      waitCount: d.waitCount,
      avgWait,
      docCount,
      totalToday: d.totalToday,
      color,
      percent
    }
  })

  return (
    <div className="lq-container">
      <header className="lq-header">
        <h1>Live queues</h1>
        <button type="button" className="lq-live-badge">
          <span className="lq-dot"></span> Updating live
        </button>
      </header>

      <div className="lq-grid">
        {deptCards.length === 0 ? (
          <p className="ao-empty" style={{ gridColumn: '1 / -1', padding: '40px 0' }}>No active departments or live queues today.</p>
        ) : deptCards.map((dept, i) => (
          <div className="lq-card" key={i}>
            <h3 style={{ color: dept.color }}>{dept.name}</h3>
            <div className="lq-card-main">
              <span className="lq-token">{dept.serving !== '--' ? dept.serving : `${dept.name.charAt(0)}-000`}</span>
              <div className={`lq-wait-badge lq-wait-${dept.waitCount > 5 ? 'high' : dept.waitCount > 2 ? 'med' : 'low'}`}>
                {dept.waitCount} waiting
              </div>
            </div>
            <div className="lq-progress-bg">
              <div className="lq-progress-fill" style={{ width: `${dept.percent}%`, backgroundColor: dept.color }}></div>
            </div>
            <div className="lq-card-footer">
              <span>Avg {dept.avgWait || 0}m</span>
              <span>{dept.docCount} doctor{dept.docCount !== 1 ? 's' : ''} · {dept.totalToday || 0} appts today</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DashboardOverview({ activeItem, onLogout, today, appointments, doctors }) {
  const [currentTime, setCurrentTime] = useState(() => new Date())
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const timeString = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(currentTime)

  const todayKey = getDateKey(currentTime)
  const todayAppointments = useMemo(() => {
    return appointments.filter(a => a.dateKey === todayKey)
  }, [appointments, todayKey])

  const totalToday = todayAppointments.length
  
  let totalWait = 0
  let waitCount = 0
  let completedCount = 0
  let noShowCount = 0

  todayAppointments.forEach(app => {
    const status = String(app.status ?? '').toLowerCase()
    if (status === 'completed' || status === 'done') {
      completedCount++
      if (app.calledAt && app.createdAt) {
        totalWait += (app.calledAt - app.createdAt) / 60000
        waitCount++
      }
    } else if (status === 'skipped' || status === 'no-show') {
      noShowCount++
    } else if (status === 'in_consult' || status === 'serving') {
      if (app.calledAt && app.createdAt) {
        totalWait += (app.calledAt - app.createdAt) / 60000
        waitCount++
      }
    }
  })

  const avgWaitTime = waitCount > 0 ? Math.round(totalWait / waitCount) : 0
  const percentageDone = totalToday > 0 ? Math.round((completedCount / totalToday) * 100) : 0
  const noShowRate = totalToday > 0 ? ((noShowCount / totalToday) * 100).toFixed(1) : 0

  const deptStats = {}
  todayAppointments.forEach(app => {
    const dept = app.department || 'Unknown'
    if (!deptStats[dept]) deptStats[dept] = 0
    deptStats[dept]++
  })
  
  const deptList = Object.entries(deptStats)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
  
  const maxDeptCount = deptList[0]?.count || 1

  const hourlyBuckets = Array(8).fill(0)
  const currentHour = currentTime.getHours()
  const startHour = Math.max(8, currentHour - 7)
  
  todayAppointments.forEach(app => {
    if (app.createdAt) {
      const h = new Date(app.createdAt).getHours()
      const index = h - startHour
      if (index >= 0 && index < 8) {
        hourlyBuckets[index]++
      }
    }
  })
  const maxHourCount = Math.max(...hourlyBuckets, 1)

  const doctorWorkload = doctors.map(doc => {
    const docApps = todayAppointments.filter(a => a.doctorId === doc.id)
    const seen = docApps.filter(a => ['completed', 'done'].includes(String(a.status ?? '').toLowerCase())).length
    const wait = docApps.filter(a => {
      const status = String(a.status ?? 'waiting').toLowerCase()
      return !['completed', 'done', 'cancelled', 'canceled', 'skipped', 'no-show'].includes(status)
    }).length
    
    let badge = 'Open'
    let badgeClass = 'open'
    const status = String(doc.status ?? 'Consulting').toLowerCase()
    if (status === 'on break' || status === 'break') {
      badge = 'Break'
      badgeClass = 'break'
    } else if (wait > 10) {
      badge = 'Busy'
      badgeClass = 'busy'
    }

    return {
      id: doc.id,
      name: doc.name,
      initials: getInitials(doc.name),
      department: doc.department,
      seen,
      wait,
      badge,
      badgeClass
    }
  }).sort((a, b) => b.wait - a.wait)

  const alerts = []
  if (doctorWorkload.some(d => d.wait > 10)) {
    const overloadedDoc = doctorWorkload.find(d => d.wait > 10)
    alerts.push({
      type: 'warning',
      title: `${overloadedDoc.department} overloaded`,
      desc: `${overloadedDoc.name} has ${overloadedDoc.wait} patients waiting — consider opening a new counter.`
    })
  }
  if (noShowRate > 10) {
    alerts.push({
      type: 'danger',
      title: 'High no-show rate',
      desc: `Currently experiencing a ${noShowRate}% no-show rate. Patients may be facing delays.`
    })
  }
  if (alerts.length === 0) {
    alerts.push({
      type: 'info',
      title: 'All systems nominal',
      desc: 'Queue loads are balanced across all active departments.'
    })
  }

  return (
    <div className="admin-overview">
      <header className="ao-header">
        <h1>{activeItem}</h1>
        <div className="ao-header-right">
          <span>{today} · {timeString}</span>
          <div className="ao-live-badge"><span className="ao-dot"></span> Live</div>
        </div>
      </header>

      <div className="ao-stats-row">
        <div className="ao-stat-card">
          <span>Patients today</span>
          <strong>{totalToday}</strong>
          <p className="ao-trend-up">Live tracking active</p>
        </div>
        <div className="ao-stat-card">
          <span>Avg wait time</span>
          <strong>{avgWaitTime}m</strong>
          <p className="ao-trend-up">Based on completed visits</p>
        </div>
        <div className="ao-stat-card">
          <span>Consultations done</span>
          <strong>{completedCount}</strong>
          <p className="ao-trend-up">{percentageDone}% of day done</p>
        </div>
        <div className="ao-stat-card">
          <span>No-shows</span>
          <strong>{noShowCount}</strong>
          <p className="ao-trend-down">{noShowRate}% no-show rate</p>
        </div>
      </div>

      <div className="ao-grid-layout">
        <div className="ao-panel">
          <h2>Patients by department</h2>
          <div className="ao-dept-list">
            {deptList.length === 0 ? (
              <p className="ao-empty">No patient data today</p>
            ) : deptList.map((dept, idx) => (
              <div className="ao-dept-row" key={dept.name}>
                <span>{dept.name}</span>
                <div className="ao-bar-bg">
                  <div 
                    className="ao-bar-fill" 
                    style={{ 
                      width: `${Math.max(5, (dept.count / maxDeptCount) * 100)}%`,
                      backgroundColor: idx === 0 ? '#2563eb' : idx === 1 ? '#60a5fa' : idx === 2 ? '#93c5fd' : idx === 3 ? '#bfdbfe' : idx === 4 ? '#e2e8f0' : '#1e3a8a'
                    }}
                  ></div>
                </div>
                <strong>{dept.count}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="ao-panel">
          <h2>Hourly patient volume</h2>
          <div className="ao-chart-area">
            {hourlyBuckets.map((count, i) => {
              const hourLabel = i === 7 ? 'Now' : (() => {
                const h = startHour + i
                const ampm = h >= 12 ? 'PM' : 'AM'
                const displayH = h % 12 || 12
                return `${displayH}${ampm}`
              })()
              
              const heightPct = Math.max(5, (count / maxHourCount) * 100)
              
              return (
                <div className="ao-chart-bar-wrap" key={i}>
                  <div className="ao-chart-bar-bg">
                    <div 
                      className="ao-chart-bar-fill" 
                      style={{ 
                        height: `${heightPct}%`,
                        backgroundColor: i === 7 ? '#bfdbfe' : '#3b82f6'
                      }}
                    ></div>
                  </div>
                  <span>{hourLabel}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="ao-panel">
          <h2>Doctor workload — now</h2>
          <div className="ao-doctor-list">
            {doctorWorkload.length === 0 ? (
              <p className="ao-empty">No active doctors</p>
            ) : doctorWorkload.map(doc => (
              <div className="ao-doctor-row" key={doc.id}>
                <div className="ao-doc-avatar">{doc.initials}</div>
                <div className="ao-doc-info">
                  <strong>{doc.name}</strong>
                  <span>{doc.department}</span>
                </div>
                <div className="ao-doc-stats">
                  {doc.seen} seen · {doc.wait} wait
                </div>
                <div className={`ao-doc-badge ao-badge-${doc.badgeClass}`}>
                  {doc.badge}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ao-panel">
          <h2>Smart alerts</h2>
          <div className="ao-alert-list">
            {alerts.map((alert, i) => (
              <div className={`ao-alert-card ao-alert-${alert.type}`} key={i}>
                <div className="ao-alert-dot"></div>
                <div className="ao-alert-content">
                  <strong>{alert.title}</strong>
                  <p>{alert.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DoctorManagement({
  doctorForm,
  doctorFormError,
  doctors,
  appointments,
  doctorsError,
  isDoctorFormOpen,
  isDoctorsLoading,
  isSavingDoctor,
  onCloseForm,
  onOpenForm,
  onSubmit,
  onUpdateField,
  onEditDoctor,
  onDeleteDoctor,
}) {
  const todayKey = getDateKey(new Date())
  return (
    <section className="doctor-management">
      <header className="doctor-management-header">
        <h1>Doctor management</h1>
        <button type="button" onClick={onOpenForm}>
          + Add doctor
        </button>
      </header>

      {isDoctorFormOpen && (
        <form className="doctor-form" onSubmit={onSubmit}>
          <div className="doctor-form-header">
            <h2>Add doctor</h2>
            <button type="button" onClick={onCloseForm}>
              Close
            </button>
          </div>

          <div className="doctor-form-grid">
            <label>
              Doctor login ID
              <input
                required
                value={doctorForm.loginId}
                onChange={(event) => onUpdateField('loginId', event.target.value)}
                placeholder="rajan-opd"
              />
            </label>

            <label>
              Doctor name
              <input
                required
                value={doctorForm.name}
                onChange={(event) => onUpdateField('name', event.target.value)}
                placeholder="Dr. Rajan Suresh"
              />
            </label>

            <label>
              Doctor department
              <input
                required
                value={doctorForm.department}
                onChange={(event) => onUpdateField('department', event.target.value)}
                placeholder="General OPD"
              />
            </label>

            <label>
              Mobile number
              <input
                required
                inputMode="tel"
                value={doctorForm.mobile}
                onChange={(event) => onUpdateField('mobile', event.target.value)}
                placeholder="9876543210"
              />
            </label>

            <label>
              Starting time
              <TimeSelectGroup
                hour={doctorForm.startHour}
                minute={doctorForm.startMinute}
                period={doctorForm.startPeriod}
                prefix="start"
                onUpdateField={onUpdateField}
              />
            </label>

            <label>
              Ending time
              <TimeSelectGroup
                hour={doctorForm.endHour}
                minute={doctorForm.endMinute}
                period={doctorForm.endPeriod}
                prefix="end"
                onUpdateField={onUpdateField}
              />
            </label>

            <label>
              No. of / day
              <input
                required
                min="1"
                type="number"
                value={doctorForm.appointmentsPerDay}
                onChange={(event) => onUpdateField('appointmentsPerDay', event.target.value)}
                placeholder="18"
              />
            </label>

            <label>
              Counter
              <input
                value={doctorForm.counter}
                onChange={(event) => onUpdateField('counter', event.target.value)}
                placeholder="e.g. Counter 1"
              />
            </label>
          </div>

          {doctorFormError && <p className="doctor-form-error">{doctorFormError}</p>}

          <button className="doctor-form-submit" disabled={isSavingDoctor} type="submit">
            {isSavingDoctor ? 'Saving...' : 'Submit doctor'}
          </button>
        </form>
      )}

      {doctorsError && <p className="doctor-data-error">{doctorsError}</p>}

      {isDoctorsLoading ? (
        <div className="doctor-empty-state">Loading doctors...</div>
      ) : doctors.length === 0 ? (
        <div className="doctor-empty-state">
          <h2>No doctors added</h2>
          <p>Add your first doctor to start managing daily appointments.</p>
          <button type="button" onClick={onOpenForm}>
            + Add doctor
          </button>
        </div>
      ) : (
        <div className="doctor-list">
          {doctors.map((doctor) => {
            const doctorAppointments = appointments.filter(a => a.doctorId === doctor.id && a.dateKey === todayKey)
            const seenCount = doctorAppointments.filter(a => String(a.status ?? '').toLowerCase() === 'completed').length
            const waitingCount = doctorAppointments.filter(a => {
              const status = String(a.status ?? 'waiting').toLowerCase()
              return !['completed', 'done', 'cancelled', 'canceled', 'skipped', 'no-show'].includes(status)
            }).length

            return (
              <DoctorCard 
                doctor={doctor} 
                seenCount={seenCount}
                waitingCount={waitingCount}
                totalBooked={doctorAppointments.length}
                key={doctor.id} 
                onEdit={() => onEditDoctor(doctor)}
                onDelete={() => onDeleteDoctor(doctor.id)}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

function TimeSelectGroup({ hour, minute, onUpdateField, period, prefix }) {
  return (
    <div className="doctor-time-selects">
      <select
        value={hour}
        onChange={(event) =>
          onUpdateField(prefix === 'start' ? 'startHour' : 'endHour', event.target.value)
        }
      >
        {hourOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <select
        value={minute}
        onChange={(event) =>
          onUpdateField(prefix === 'start' ? 'startMinute' : 'endMinute', event.target.value)
        }
      >
        {minuteOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <select
        value={period}
        onChange={(event) =>
          onUpdateField(prefix === 'start' ? 'startPeriod' : 'endPeriod', event.target.value)
        }
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  )
}

function DoctorCard({ doctor, seenCount, waitingCount, totalBooked, onEdit, onDelete }) {
  const appointmentsPerDay = Number(doctor.appointmentsPerDay) || 0
  const remainingAppts = Math.max(0, appointmentsPerDay - (totalBooked || 0))

  return (
    <article className="doctor-card">
      <div className="doctor-card-main">
        <div className="doctor-avatar">{getInitials(doctor.name || 'Doctor')}</div>
        <div>
          <h2>{doctor.name}</h2>
          <p>
            {doctor.department} - {formatTimeRange(doctor.startTime, doctor.endTime)}
            {doctor.counter ? ` | ${doctor.counter}` : ''}
          </p>
          <span>{doctor.mobile}</span>
          {doctor.loginId && <span>Login ID: {doctor.loginId}</span>}
        </div>
      </div>

      <div className="doctor-status">{doctor.status || 'Consulting'}</div>
      
      <div className="doctor-actions">
        <button type="button" onClick={onEdit} className="btn-edit">Edit</button>
        <button type="button" onClick={onDelete} className="btn-delete">Delete</button>
      </div>

      <div className="doctor-metrics">
        <div>
          <strong>{seenCount ?? 0}</strong>
          <span>Seen</span>
        </div>
        <div>
          <strong className="doctor-waiting-count">{waitingCount ?? 0}</strong>
          <span>Waiting</span>
        </div>
        <div>
          <strong>{remainingAppts}</strong>
          <span>Appts</span>
        </div>
        <div>
          <strong>{getAverageSlot(doctor.startTime, doctor.endTime, appointmentsPerDay)}</strong>
          <span>Avg time</span>
        </div>
      </div>
    </article>
  )
}

export default AdminPage

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

    return unsubscribe
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
        ) : (
          <DashboardOverview activeItem={activeItem} onLogout={handleLogout} today={today} />
        )}
      </section>
    </main>
  )
}

function DashboardOverview({ activeItem, onLogout, today }) {
  return (
    <>
      <header className="admin-topbar">
        <div>
          <p>{today}</p>
          <h1>{activeItem}</h1>
        </div>
        <button type="button" onClick={onLogout}>
          Logout
        </button>
      </header>

      <section className="admin-stat-grid" aria-label="Dashboard summary">
        <article>
          <span>Patients today</span>
          <strong>128</strong>
          <p>24 waiting now</p>
        </article>
        <article>
          <span>Active doctors</span>
          <strong>8</strong>
          <p>3 departments live</p>
        </article>
        <article>
          <span>Avg wait</span>
          <strong>18m</strong>
          <p>Down 6m from yesterday</p>
        </article>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Live queues</h2>
          <span>Auto refresh ready</span>
        </div>

        <div className="admin-table">
          {queueRows.map((row) => (
            <div className="admin-table-row" key={row.token}>
              <strong>{row.token}</strong>
              <span>{row.patient}</span>
              <span>{row.department}</span>
              <em>{row.status}</em>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function DoctorManagement({
  doctorForm,
  doctorFormError,
  doctors,
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
          {doctors.map((doctor) => (
            <DoctorCard 
              doctor={doctor} 
              key={doctor.id} 
              onEdit={() => onEditDoctor(doctor)}
              onDelete={() => onDeleteDoctor(doctor.id)}
            />
          ))}
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

function DoctorCard({ doctor, onEdit, onDelete }) {
  const appointmentsPerDay = Number(doctor.appointmentsPerDay) || 0

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
          <strong>0</strong>
          <span>Seen</span>
        </div>
        <div>
          <strong className="doctor-waiting-count">0</strong>
          <span>Waiting</span>
        </div>
        <div>
          <strong>{appointmentsPerDay}</strong>
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

import { useMemo, useState } from 'react'
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

function AdminPage() {
  const [isAuthed, setIsAuthed] = useState(() => sessionStorage.getItem('carequeue-admin') === '1')
  const [activeItem, setActiveItem] = useState('Overview')
  const [formData, setFormData] = useState({ username: '', password: '' })
  const [error, setError] = useState('')

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }).format(new Date()),
    [],
  )

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

      <section className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <p>{today}</p>
            <h1>{activeItem}</h1>
          </div>
          <button type="button" onClick={handleLogout}>
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
      </section>
    </main>
  )
}

export default AdminPage

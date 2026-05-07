import { useEffect, useState } from 'react'
import { onValue, push, ref as databaseRef, serverTimestamp } from 'firebase/database'
import { database } from '../lib/firebase.jsx'
import '../components/SuperAdminPage.css'

const SUPER_ADMIN = {
  username: 'superadmin',
  password: 'superadmin123'
}

function SuperAdminPage() {
  const [isAuthed, setIsAuthed] = useState(() => sessionStorage.getItem('carequeue-superadmin') === '1')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  
  const [hospitals, setHospitals] = useState([])
  const [isAddFormOpen, setIsAddFormOpen] = useState(false)
  const [newHospital, setNewHospital] = useState({ name: '', location: '', contact: '' })

  useEffect(() => {
    if (!isAuthed) return

    const unsubscribe = onValue(databaseRef(database, 'hospitals'), (snapshot) => {
      const data = snapshot.val()
      if (!data) {
        setHospitals([])
        return
      }
      setHospitals(Object.entries(data).map(([id, info]) => ({ id, ...info })))
    })

    return () => unsubscribe()
  }, [isAuthed])

  const handleLogin = (e) => {
    e.preventDefault()
    if (username === SUPER_ADMIN.username && password === SUPER_ADMIN.password) {
      sessionStorage.setItem('carequeue-superadmin', '1')
      setIsAuthed(true)
      setError('')
    } else {
      setError('Invalid username or password')
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('carequeue-superadmin')
    setIsAuthed(false)
    setUsername('')
    setPassword('')
  }

  const handleAddHospital = async (e) => {
    e.preventDefault()
    if (!newHospital.name) return

    try {
      await push(databaseRef(database, 'hospitals'), {
        ...newHospital,
        createdAt: serverTimestamp()
      })
      setIsAddFormOpen(false)
      setNewHospital({ name: '', location: '', contact: '' })
    } catch (err) {
      alert('Failed to add hospital: ' + err.message)
    }
  }

  const handleLoginAsHospital = (hospitalId) => {
    // Set a context or simply redirect to /admin. 
    // In a multi-tenant system this would set the active tenant ID.
    // For now we simulate by storing it and navigating.
    sessionStorage.setItem('carequeue-admin', '1')
    sessionStorage.setItem('carequeue-active-hospital', hospitalId)
    window.location.href = '/admin'
  }

  if (!isAuthed) {
    return (
      <div className="sa-login-page">
        <form className="sa-login-card" onSubmit={handleLogin}>
          <div>
            <h1>Super Admin</h1>
            <p>Sign in to manage all hospitals and settings</p>
          </div>
          <label>
            Username
            <input 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              placeholder="Enter username" 
            />
          </label>
          <label>
            Password
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Enter password" 
            />
          </label>
          {error && <p className="sa-login-error">{error}</p>}
          <button type="submit">Login</button>
        </form>
      </div>
    )
  }

  return (
    <div className="superadmin-container">
      <aside className="sa-sidebar">
        <div className="sa-sidebar-header">
          <h1>CareQueue Network</h1>
          <p>Super Admin Portal</p>
        </div>
        <nav className="sa-sidebar-nav">
          <button 
            className="sa-nav-item" 
            data-active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className="sa-nav-item" 
            data-active={activeTab === 'hospitals'}
            onClick={() => setActiveTab('hospitals')}
          >
            Hospitals
          </button>
          <button 
            className="sa-nav-item" 
            data-active={activeTab === 'publishing'}
            onClick={() => setActiveTab('publishing')}
          >
            Publishing
          </button>
          <button 
            className="sa-nav-item" 
            data-active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </nav>
        <div className="sa-sidebar-footer">
          <button className="sa-logout-btn" onClick={handleLogout}>Log Out</button>
        </div>
      </aside>

      <main className="sa-main">
        {activeTab === 'overview' && (
          <div className="sa-tab-content">
            <div className="sa-page-header">
              <h2>Network Overview</h2>
            </div>
            <div className="sa-stats-grid">
              <div className="sa-stat-card">
                <span>Total Hospitals</span>
                <strong>{hospitals.length}</strong>
              </div>
              <div className="sa-stat-card">
                <span>Active Doctors</span>
                <strong>--</strong>
              </div>
              <div className="sa-stat-card">
                <span>Total Patients (Today)</span>
                <strong>--</strong>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hospitals' && (
          <div className="sa-tab-content">
            <div className="sa-page-header">
              <h2>Manage Hospitals</h2>
              <button className="sa-primary-btn" onClick={() => setIsAddFormOpen(true)}>
                + Add Hospital
              </button>
            </div>
            
            <div className="sa-hospitals-grid">
              {hospitals.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>No hospitals registered yet.</p>
              ) : (
                hospitals.map(hosp => (
                  <div className="sa-hospital-card" key={hosp.id}>
                    <div>
                      <h3>{hosp.name}</h3>
                      {hosp.location && <p>{hosp.location}</p>}
                      {hosp.contact && <p>Contact: {hosp.contact}</p>}
                    </div>
                    <div className="sa-hospital-actions">
                      <button className="sa-action-btn">Edit</button>
                      <button 
                        className="sa-action-btn login-as" 
                        onClick={() => handleLoginAsHospital(hosp.id)}
                      >
                        Login As
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'publishing' && (
          <div className="sa-placeholder">
            <h3>Publishing Configuration</h3>
            <p>Manage content, ads, and network-wide broadcasts here.</p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="sa-placeholder">
            <h3>Global Settings</h3>
            <p>Configure network policies, super admin access, and integrations.</p>
          </div>
        )}
      </main>

      {isAddFormOpen && (
        <div className="sa-form-overlay">
          <form className="sa-form-card" onSubmit={handleAddHospital}>
            <div className="sa-form-header">
              <h3>Add New Hospital</h3>
              <button type="button" className="sa-close-btn" onClick={() => setIsAddFormOpen(false)}>&times;</button>
            </div>
            <div className="sa-form-group">
              <label>Hospital Name</label>
              <input 
                required
                value={newHospital.name} 
                onChange={e => setNewHospital({...newHospital, name: e.target.value})}
                placeholder="e.g. City General Hospital"
              />
            </div>
            <div className="sa-form-group">
              <label>Location / Address</label>
              <input 
                value={newHospital.location} 
                onChange={e => setNewHospital({...newHospital, location: e.target.value})}
                placeholder="e.g. Downtown Metro Area"
              />
            </div>
            <div className="sa-form-group">
              <label>Contact Info</label>
              <input 
                value={newHospital.contact} 
                onChange={e => setNewHospital({...newHospital, contact: e.target.value})}
                placeholder="e.g. admin@citygeneral.com"
              />
            </div>
            <button type="submit" className="sa-submit-btn">Register Hospital</button>
          </form>
        </div>
      )}
    </div>
  )
}

export default SuperAdminPage

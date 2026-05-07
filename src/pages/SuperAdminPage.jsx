import { useEffect, useState } from 'react'
import { onValue, push, update, ref as databaseRef, serverTimestamp } from 'firebase/database'
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
  
  const [adUrl, setAdUrl] = useState('')
  const [adType, setAdType] = useState('image')
  const [isSavingAd, setIsSavingAd] = useState(false)

  useEffect(() => {
    if (!isAuthed) return

    const unsubscribe = onValue(databaseRef(database, 'hospitals'), (snapshot) => {
      const data = snapshot.val()
      const defaultHospital = { 
        id: 'default-primary', 
        name: 'City Health Clinic (Primary)', 
        location: 'Main Headquarters', 
        contact: 'admin@cityhealth.com', 
        isPrimary: true 
      }
      if (!data) {
        setHospitals([defaultHospital])
      } else {
        setHospitals([defaultHospital, ...Object.entries(data).map(([id, info]) => ({ id, ...info }))])
      }
    })

    const unsubAd = onValue(databaseRef(database, 'settings/tvAd'), (snapshot) => {
      const data = snapshot.val()
      if (data) {
        setAdUrl(data.url || '')
        setAdType(data.type || 'image')
      }
    })

    return () => {
      unsubscribe()
      unsubAd()
    }
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

  const handleSaveAd = async (e) => {
    e.preventDefault()
    setIsSavingAd(true)
    try {
      await update(databaseRef(database, 'settings'), {
        tvAd: { url: adUrl, type: adType }
      })
      alert('TV Advertisement updated successfully!')
    } catch (err) {
      alert('Failed to save ad: ' + err.message)
    } finally {
      setIsSavingAd(false)
    }
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
          <div className="sa-tab-content">
            <div className="sa-page-header">
              <h2>Publishing Configuration</h2>
            </div>
            
            <div className="sa-hospital-card" style={{ maxWidth: '600px' }}>
              <h3>TV Screen Advertisement</h3>
              <p>Configure the image or video that plays on the right side of the TV display.</p>
              
              <form onSubmit={handleSaveAd} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <div className="sa-form-group" style={{ margin: 0 }}>
                  <label>Media Type</label>
                  <select 
                    value={adType} 
                    onChange={e => setAdType(e.target.value)}
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '15px', outline: 'none' }}
                  >
                    <option value="image">Image (JPG, PNG, GIF)</option>
                    <option value="video">Video (MP4, WebM)</option>
                  </select>
                </div>
                
                <div className="sa-form-group" style={{ margin: 0 }}>
                  <label>Media URL (Image or Video Link)</label>
                  <input 
                    required
                    type="url"
                    value={adUrl} 
                    onChange={e => setAdUrl(e.target.value)}
                    placeholder="https://example.com/ad.jpg"
                  />
                </div>

                {adUrl && (
                  <div style={{ marginTop: '8px', border: '1px dashed #334155', borderRadius: '8px', padding: '8px', background: '#020617' }}>
                    <p style={{ marginBottom: '8px', fontSize: '12px', color: '#94a3b8' }}>Preview:</p>
                    {adType === 'video' ? (
                      <video src={adUrl} controls style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }} />
                    ) : (
                      <img src={adUrl} alt="Ad preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }} />
                    )}
                  </div>
                )}
                
                <button type="submit" className="sa-submit-btn" disabled={isSavingAd}>
                  {isSavingAd ? 'Saving...' : 'Publish to TV Screens'}
                </button>
              </form>
            </div>
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

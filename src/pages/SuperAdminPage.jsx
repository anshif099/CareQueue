import { useEffect, useState } from 'react'
import { onValue, push, remove, set, update, ref as databaseRef, serverTimestamp } from 'firebase/database'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { database } from '../lib/firebase.jsx'
import '../components/SuperAdminPage.css'

const SUPER_ADMIN = {
  username: 'superadmin',
  password: 'superadmin123'
}

const AD_IMAGE_MAX_WIDTH = 1600
const AD_IMAGE_MAX_HEIGHT = 1300
const AD_IMAGE_QUALITY = 0.88
const DIRECT_IMAGE_MAX_BYTES = 4 * 1024 * 1024

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('Unable to read selected image.'))
    reader.readAsDataURL(file)
  })
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

function loadImageFromObjectUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to process selected image.'))
    image.src = url
  })
}

async function processAdImageFile(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }

  if (['image/gif', 'image/svg+xml'].includes(file.type)) {
    if (file.size > DIRECT_IMAGE_MAX_BYTES) {
      throw new Error('Please choose a GIF or SVG smaller than 4 MB.')
    }
    return {
      dataUrl: await readFileAsDataUrl(file),
      height: null,
      name: file.name,
      width: null,
    }
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImageFromObjectUrl(objectUrl)
    const scale = Math.min(
      1,
      AD_IMAGE_MAX_WIDTH / image.naturalWidth,
      AD_IMAGE_MAX_HEIGHT / image.naturalHeight,
    )
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    canvas.width = width
    canvas.height = height
    if (!context) {
      throw new Error('Unable to prepare image preview.')
    }

    context.fillStyle = '#0b111a'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    return {
      dataUrl: canvas.toDataURL('image/jpeg', AD_IMAGE_QUALITY),
      height,
      name: file.name,
      width,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function SuperAdminPage() {
  const [isAuthed, setIsAuthed] = useState(() => sessionStorage.getItem('carequeue-superadmin') === '1')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  
  const [hospitals, setHospitals] = useState([])
  const [isHospitalFormOpen, setIsHospitalFormOpen] = useState(false)
  const [editingHospitalId, setEditingHospitalId] = useState(null)
  const [hospitalForm, setHospitalForm] = useState({ name: '', location: '', contact: '', adminUsername: '', adminPassword: '' })
  
  const [adUrl, setAdUrl] = useState('')
  const [adType, setAdType] = useState('image')
  const [adFileName, setAdFileName] = useState('')
  const [adSchedule, setAdSchedule] = useState('')
  const [adError, setAdError] = useState('')
  const [isProcessingAdFile, setIsProcessingAdFile] = useState(false)
  const [isSavingAd, setIsSavingAd] = useState(false)
  const [tvAds, setTvAds] = useState([])

  const [doctors, setDoctors] = useState([])
  const [appointments, setAppointments] = useState([])
  const isBase64AdImage = adType === 'image' && adUrl.startsWith('data:image/')

  const getTodayKey = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

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

    const unsubAds = onValue(databaseRef(database, 'settings/tvAds'), (snapshot) => {
      const data = snapshot.val()
      if (data) {
        setTvAds(Object.entries(data).map(([id, ad]) => ({ id, ...ad })).sort((a, b) => new Date(b.scheduledAt || 0) - new Date(a.scheduledAt || 0)))
      } else {
        setTvAds([])
      }
    })

    const unsubDocs = onValue(databaseRef(database, 'doctors'), (snapshot) => {
      const data = snapshot.val()
      if (data) setDoctors(Object.entries(data).map(([id, doc]) => ({ id, ...doc })))
      else setDoctors([])
    })

    const unsubAppts = onValue(databaseRef(database, 'appointments'), (snapshot) => {
      const data = snapshot.val()
      if (data) setAppointments(Object.entries(data).map(([id, app]) => ({ id, ...app })))
      else setAppointments([])
    })

    return () => {
      unsubscribe()
      unsubAds()
      unsubDocs()
      unsubAppts()
    }
  }, [isAuthed])

  const todayKey = getTodayKey()
  const todayAppointments = appointments.filter(a => a.dateKey === todayKey)
  const activeDoctors = doctors.filter(d => (d.status || 'Consulting') === 'Consulting')
  
  const hourlyData = Array.from({ length: 12 }, (_, i) => {
    const hour = i + 8 // 8 AM to 7 PM
    const count = todayAppointments.filter(app => {
      if (!app.createdAt) return false
      const d = new Date(app.createdAt)
      return d.getHours() === hour
    }).length
    return { name: `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'pm' : 'am'}`, patients: count }
  })

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

  const handleSaveHospital = async (e) => {
    e.preventDefault()
    if (!hospitalForm.name) return

    try {
      if (editingHospitalId) {
        if (editingHospitalId === 'default-primary') {
           // Ignore update for primary as it's hardcoded for now, or alert
           alert('Cannot edit the default primary hospital from here yet.')
           setIsHospitalFormOpen(false)
           return
        }
        await update(databaseRef(database, `hospitals/${editingHospitalId}`), hospitalForm)
      } else {
        await push(databaseRef(database, 'hospitals'), {
          ...hospitalForm,
          createdAt: serverTimestamp()
        })
      }
      setIsHospitalFormOpen(false)
      setHospitalForm({ name: '', location: '', contact: '' })
      setEditingHospitalId(null)
    } catch (err) {
      alert('Failed to save hospital: ' + err.message)
    }
  }

  const openEditHospital = (hosp) => {
    if (hosp.isPrimary) {
      alert('Cannot edit the default primary hospital from here yet.')
      return
    }
    setHospitalForm({
      name: hosp.name || '',
      location: hosp.location || '',
      contact: hosp.contact || '',
      adminUsername: hosp.adminUsername || '',
      adminPassword: hosp.adminPassword || ''
    })
    setEditingHospitalId(hosp.id)
    setIsHospitalFormOpen(true)
  }

  const openAddHospital = () => {
    setHospitalForm({ name: '', location: '', contact: '', adminUsername: '', adminPassword: '' })
    setEditingHospitalId(null)
    setIsHospitalFormOpen(true)
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
    const nextAdUrl = adUrl.trim()

    if (!nextAdUrl) {
      setAdError('Upload an image or enter a media URL before publishing.')
      return
    }

    if (!adSchedule) {
      setAdError('Please select a scheduled date and time.')
      return
    }

    setIsSavingAd(true)
    setAdError('')
    try {
      const nextAd = {
        source: isBase64AdImage ? 'base64' : 'url',
        type: adType,
        createdAt: serverTimestamp(),
        scheduledAt: new Date(adSchedule).toISOString(),
        url: nextAdUrl,
      }

      if (adFileName) {
        nextAd.name = adFileName
      }

      await push(databaseRef(database, 'settings/tvAds'), nextAd)
      alert('TV Advertisement scheduled successfully!')
      setAdUrl('')
      setAdFileName('')
      setAdSchedule('')
    } catch (err) {
      alert('Failed to save ad: ' + err.message)
    } finally {
      setIsSavingAd(false)
    }
  }

  const handleAdTypeChange = (e) => {
    const nextType = e.target.value
    setAdType(nextType)
    setAdError('')

    // Clear Base64 if switching types to avoid mismatch (e.g. video tag trying to play image base64)
    if (adUrl.startsWith('data:')) {
      const isUrlForImage = adUrl.startsWith('data:image/')
      const isUrlForVideo = adUrl.startsWith('data:video/')
      
      if ((nextType === 'video' && !isUrlForVideo) || (nextType === 'image' && !isUrlForImage)) {
        setAdUrl('')
        setAdFileName('')
      }
    }
  }

  const handleAdUrlChange = (e) => {
    setAdUrl(e.target.value)
    setAdFileName('')
    setAdError('')
  }

  const handleAdFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsProcessingAdFile(true)
    setAdError('')

    try {
      if (adType === 'video') {
        if (!file.type.startsWith('video/')) {
          throw new Error('Please choose a video file.')
        }
        // 25MB limit for video Base64 in Realtime Database (generous but risky)
        if (file.size > 25 * 1024 * 1024) {
          throw new Error('Please choose a video smaller than 25 MB.')
        }
        const dataUrl = await readFileAsDataUrl(file)
        setAdUrl(dataUrl)
        setAdFileName(file.name)
      } else {
        const processedImage = await processAdImageFile(file)
        setAdUrl(processedImage.dataUrl)
        setAdFileName(processedImage.name)
      }
    } catch (err) {
      setAdError(err.message || 'Failed to process the selected file.')
    } finally {
      setIsProcessingAdFile(false)
      e.target.value = ''
    }
  }

  const handleRemoveAd = async (adId) => {
    if (!confirm('Are you sure you want to remove this advertisement?')) return
    
    setIsSavingAd(true)
    try {
      await remove(databaseRef(database, `settings/tvAds/${adId}`))
    } catch (err) {
      alert('Failed to remove ad: ' + err.message)
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
                <strong>{activeDoctors.length}</strong>
              </div>
              <div className="sa-stat-card">
                <span>Total Patients (Today)</span>
                <strong>{todayAppointments.length}</strong>
              </div>
            </div>

            <div style={{ marginTop: '40px', background: '#0f172a', padding: '24px', borderRadius: '12px', border: '1px solid #1e293b' }}>
              <h3 style={{ color: '#f8fafc', marginTop: 0, marginBottom: '24px' }}>Hourly Patient Flow (Network Wide)</h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                    <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                      itemStyle={{ color: '#3b82f6' }}
                    />
                    <Bar dataKey="patients" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hospitals' && (
          <div className="sa-tab-content">
            <div className="sa-page-header">
              <h2>Manage Hospitals</h2>
              <button className="sa-primary-btn" onClick={openAddHospital}>
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
                      <button className="sa-action-btn" onClick={() => openEditHospital(hosp)}>Edit</button>
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
                    onChange={handleAdTypeChange}
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '15px', outline: 'none' }}
                  >
                    <option value="image">Image (JPG, PNG, GIF)</option>
                    <option value="video">Video (MP4, WebM)</option>
                  </select>
                </div>
                
                <div className="sa-form-group" style={{ margin: 0 }}>
                  <label>Media URL (Image or Video Link)</label>
                  <input 
                    disabled={isBase64AdImage || isProcessingAdFile || isSavingAd}
                    required={!isBase64AdImage}
                    type="text"
                    value={isBase64AdImage ? '' : adUrl}
                    onChange={handleAdUrlChange}
                    placeholder={isBase64AdImage ? 'Uploaded image ready to publish' : 'https://example.com/ad.jpg'}
                  />
                </div>

                <div className="sa-form-group" style={{ margin: 0 }}>
                  <label>{adType === 'video' ? 'Upload Video File' : 'Upload Image File'}</label>
                  <input
                    accept={adType === 'video' ? 'video/*' : 'image/*'}
                    disabled={isProcessingAdFile || isSavingAd}
                    onChange={handleAdFileChange}
                    type="file"
                  />
                  {adFileName && <p style={{ fontSize: '12px', color: '#94a3b8' }}>Selected file: {adFileName}</p>}
                  {adUrl.startsWith('data:') && (
                    <button
                      className="sa-action-btn"
                      disabled={isProcessingAdFile || isSavingAd}
                      onClick={() => {
                        setAdUrl('')
                        setAdFileName('')
                        setAdError('')
                      }}
                      type="button"
                    >
                      Use {adType === 'video' ? 'Video' : 'Image'} URL Instead
                    </button>
                  )}
                </div>

                <div className="sa-form-group" style={{ margin: 0 }}>
                  <label>Scheduled Publishing Date & Time</label>
                  <input 
                    required
                    type="datetime-local"
                    value={adSchedule}
                    onChange={(e) => setAdSchedule(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                  <p style={{ fontSize: '12px', color: '#94a3b8' }}>Content will automatically replace the old one at this time.</p>
                </div>

                {adError && <p className="sa-login-error">{adError}</p>}

                {adUrl && (
                  <div style={{ marginTop: '8px', border: '1px dashed #334155', borderRadius: '8px', padding: '8px', background: '#020617' }}>
                    <p style={{ marginBottom: '8px', fontSize: '12px', color: '#94a3b8' }}>Preview:</p>
                    {adType === 'video' ? (
                      extractYouTubeVideoId(adUrl) ? (
                        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '4px' }}>
                          <iframe
                            src={`https://www.youtube.com/embed/${extractYouTubeVideoId(adUrl)}?controls=0`}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                          />
                        </div>
                      ) : (
                        <video key={adUrl} src={adUrl} controls style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }} />
                      )
                    ) : (
                      <img src={adUrl} alt="Ad preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }} />
                    )}
                  </div>
                )}
                
                <button type="submit" className="sa-submit-btn" disabled={isSavingAd || isProcessingAdFile}>
                  {isProcessingAdFile ? 'Processing...' : isSavingAd ? 'Saving...' : 'Schedule & Publish'}
                </button>
              </form>
            </div>

            {tvAds.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <h3 style={{ color: '#f8fafc', marginBottom: '16px' }}>Current & Scheduled Advertisements</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {tvAds.map(ad => {
                    const isPast = new Date(ad.scheduledAt) <= new Date()
                    return (
                      <div key={ad.id} className="sa-hospital-card" style={{ borderLeft: isPast ? '4px solid #3b82f6' : '4px solid #10b981' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: isPast ? '#3b82f622' : '#10b98122', color: isPast ? '#3b82f6' : '#10b981' }}>
                            {isPast ? 'Currently Active' : 'Scheduled'}
                          </span>
                          <button 
                            onClick={() => handleRemoveAd(ad.id)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px' }}
                          >
                            &times;
                          </button>
                        </div>
                        <div style={{ height: '120px', background: '#020617', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                          {ad.type === 'video' ? (
                            extractYouTubeVideoId(ad.url) ? (
                              <img src={`https://img.youtube.com/vi/${extractYouTubeVideoId(ad.url)}/mqdefault.jpg`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <video src={ad.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )
                          ) : (
                            <img src={ad.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          )}
                        </div>
                        <p style={{ fontSize: '13px', color: '#f8fafc', margin: '4px 0' }}><strong>Type:</strong> {ad.type}</p>
                        <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0' }}>
                          <strong>Date:</strong> {new Date(ad.scheduledAt).toLocaleString()}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="sa-placeholder">
            <h3>Global Settings</h3>
            <p>Configure network policies, super admin access, and integrations.</p>
          </div>
        )}
      </main>

      {isHospitalFormOpen && (
        <div className="sa-form-overlay">
          <form className="sa-form-card" onSubmit={handleSaveHospital}>
            <div className="sa-form-header">
              <h3>{editingHospitalId ? 'Edit Hospital' : 'Add New Hospital'}</h3>
              <button type="button" className="sa-close-btn" onClick={() => setIsHospitalFormOpen(false)}>&times;</button>
            </div>
            <div className="sa-form-group">
              <label>Hospital Name</label>
              <input 
                required
                value={hospitalForm.name} 
                onChange={e => setHospitalForm({...hospitalForm, name: e.target.value})}
                placeholder="e.g. City General Hospital"
              />
            </div>
            <div className="sa-form-group">
              <label>Location / Address</label>
              <input 
                value={hospitalForm.location} 
                onChange={e => setHospitalForm({...hospitalForm, location: e.target.value})}
                placeholder="e.g. Downtown Metro Area"
              />
            </div>
            <div className="sa-form-group">
              <label>Contact Info</label>
              <input 
                value={hospitalForm.contact} 
                onChange={e => setHospitalForm({...hospitalForm, contact: e.target.value})}
                placeholder="e.g. admin@citygeneral.com"
              />
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #1e293b', margin: '16px 0' }} />
            <h4 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '16px' }}>Admin Panel Credentials</h4>
            <div className="sa-form-group">
              <label>Admin Login ID</label>
              <input 
                required
                value={hospitalForm.adminUsername} 
                onChange={e => setHospitalForm({...hospitalForm, adminUsername: e.target.value})}
                placeholder="e.g. city-admin"
              />
            </div>
            <div className="sa-form-group">
              <label>Admin Password</label>
              <input 
                required
                value={hospitalForm.adminPassword} 
                onChange={e => setHospitalForm({...hospitalForm, adminPassword: e.target.value})}
                placeholder="e.g. password123"
                type="text"
              />
            </div>
            <button type="submit" className="sa-submit-btn">
              {editingHospitalId ? 'Save Changes' : 'Register Hospital'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default SuperAdminPage

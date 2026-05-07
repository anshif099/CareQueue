import { useEffect, useMemo, useState } from 'react'
import { onValue, ref as databaseRef, update } from 'firebase/database'
import { database } from '../lib/firebase.jsx'
import '../components/LabPage.css'

function mapAppointments(snapshot) {
  const appointments = snapshot.val()
  if (!appointments) return []
  return Object.entries(appointments).map(([id, appointment]) => ({ id, ...appointment }))
}

function LabPage() {
  const [appointments, setAppointments] = useState([])
  const [searchToken, setSearchToken] = useState('')
  const [activePatientId, setActivePatientId] = useState(null)
  
  const [medicinesGiven, setMedicinesGiven] = useState(false)
  const [itemAmounts, setItemAmounts] = useState({})

  useEffect(() => {
    const appointmentsRef = databaseRef(database, 'appointments')
    const unsubscribe = onValue(appointmentsRef, (snapshot) => {
      setAppointments(mapAppointments(snapshot))
    })
    return () => unsubscribe()
  }, [])

  // Filter for patients who have a prescription but lab is not yet completed
  const labQueue = useMemo(() => {
    let queue = appointments.filter(app => {
      // Must have prescription
      if (!app.prescription) return false
      // Must not be already processed by lab
      if (app.labStatus === 'completed') return false
      // Optional: limit to today's appointments if needed, but for lab maybe not needed if they come next day.
      return true
    })

    if (searchToken.trim() !== '') {
      const lowerSearch = searchToken.toLowerCase()
      queue = queue.filter(app => String(app.token).toLowerCase().includes(lowerSearch))
    }

    // Sort by creation or call time
    return queue.sort((a, b) => (Number(a.completedAt) || 0) - (Number(b.completedAt) || 0))
  }, [appointments, searchToken])

  const activePatient = useMemo(() => {
    return labQueue.find(p => p.id === activePatientId)
  }, [labQueue, activePatientId])

  // Handle patient selection
  const handleSelectPatient = (id) => {
    setActivePatientId(id)
    setMedicinesGiven(false)
    setItemAmounts({})
  }

  const prescriptionLines = useMemo(() => {
    return activePatient?.prescription ? activePatient.prescription.split('\n').filter(line => line.trim()) : []
  }, [activePatient])

  const totalBill = useMemo(() => {
    return Object.values(itemAmounts).reduce((sum, val) => sum + (Number(val) || 0), 0)
  }, [itemAmounts])

  const handleAmountChange = (index, value) => {
    setItemAmounts(prev => ({
      ...prev,
      [index]: value
    }))
  }

  const handleSubmitLab = async () => {
    if (!activePatient) return

    await update(databaseRef(database, `appointments/${activePatient.id}`), {
      labBillAmount: totalBill || 0,
      medicinesGiven: medicinesGiven,
      labStatus: 'completed',
      labCompletedAt: Date.now()
    })
    
    // Deselect and stay on lab page
    setActivePatientId(null)
    setMedicinesGiven(false)
    setItemAmounts({})
  }

  return (
    <main className="lab-workspace">
      <aside className="lab-sidebar">
        <div className="lab-sidebar-header">
          <h2>Lab & Pharmacy</h2>
        </div>
        
        <div className="lab-search">
          <input 
            type="text" 
            placeholder="Search by token..." 
            value={searchToken}
            onChange={(e) => setSearchToken(e.target.value)}
          />
        </div>

        <div className="lab-queue">
          {labQueue.length === 0 ? (
            <p className="lab-empty">No pending prescriptions</p>
          ) : (
            labQueue.map(patient => (
              <div 
                key={patient.id}
                className={`lab-queue-item ${activePatientId === patient.id ? 'active' : ''}`}
                onClick={() => handleSelectPatient(patient.id)}
              >
                <strong>{patient.token}</strong>
                <span>{patient.department}</span>
              </div>
            ))
          )}
        </div>
      </aside>

      <section className="lab-main">
        {!activePatient ? (
          <div className="lab-no-selection">
            <p>Select a patient from the queue to process their prescription.</p>
          </div>
        ) : (
          <div className="lab-panel">
            <header className="lab-panel-header">
              <h1>Token: {activePatient.token}</h1>
              <span className="lab-dept-badge">{activePatient.department}</span>
            </header>

            <div className="lab-section">
              <h3>Prescription Details & Billing</h3>
              <div className="lab-prescription-list">
                {prescriptionLines.length > 0 ? prescriptionLines.map((line, i) => (
                  <div className="lab-presc-item" key={i}>
                    <span className="lab-presc-text">{line}</span>
                    <div className="lab-presc-amount">
                      <span>₹</span>
                      <input 
                        type="number" 
                        placeholder="0"
                        value={itemAmounts[i] || ''}
                        onChange={(e) => handleAmountChange(i, e.target.value)}
                      />
                    </div>
                  </div>
                )) : (
                  <p className="lab-empty">No prescription details provided.</p>
                )}
              </div>
            </div>

            <div className="lab-section lab-actions-section">
              <h3>Pharmacy & Billing</h3>
              
              <label className="lab-checkbox-label">
                <input 
                  type="checkbox" 
                  checked={medicinesGiven}
                  onChange={(e) => setMedicinesGiven(e.target.checked)}
                />
                Mark Medicines as Given / Available
              </label>

              <div className="lab-bill-total">
                <span>Total Bill Amount:</span>
                <strong>₹ {totalBill}</strong>
              </div>

              <button className="lab-submit-btn" onClick={handleSubmitLab}>
                Save Record & Send Bill
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default LabPage

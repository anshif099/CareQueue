import { useEffect, useMemo, useState } from 'react'
import { onValue, ref as databaseRef, update } from 'firebase/database'
import { database } from '../lib/firebase.jsx'
import '../components/LabPage.css'

function mapAppointments(snapshot) {
  const appointments = snapshot.val()
  if (!appointments) return []
  return Object.entries(appointments).map(([id, appointment]) => ({ id, ...appointment }))
}

function isPrescriptionMedicineLine(line) {
  const trimmedLine = line.trim()
  if (!trimmedLine) return false
  if (/^\*\*.+\*\*$/.test(trimmedLine)) return false

  const normalizedLine = trimmedLine
    .replace(/^\d+[.)]\s*/, '')
    .replace(/^[-*\u2022]\s*/, '')
    .replace(/\*\*/g, '')
    .trim()
  const lowerLine = normalizedLine.toLowerCase()
  const metadataLabels = [
    'age:',
    'date:',
    'diagnosis:',
    'dr.',
    'dr:',
    'doctor:',
    'medicines:',
    'medicine:',
    'patient name:',
    'prescription:',
  ]
  const instructionWords = [
    'advised',
    'avoid',
    'consult',
    'diet',
    'drink',
    'rest',
    'review',
    'steam',
  ]

  if (metadataLabels.some((label) => lowerLine.startsWith(label))) return false
  if (lowerLine.includes('consultation')) return false

  const hasMedicineForm = /\b(tab|tablet|cap|capsule|syrup|inj|injection|drop|drops|cream|ointment|gel|spray|sachet|solution|suspension|lotion)\b/i.test(normalizedLine)
  const hasDosageUnit = /\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|units?|%)\b/i.test(normalizedLine)
  const hasListMarker = /^(\d+[.)]|[-*\u2022])\s+/.test(trimmedLine)
  const hasDoseSchedule = /\b(od|bd|tds|qid|hs|stat|sos|daily|once|twice|morning|night|days?)\b/i.test(normalizedLine)
  const isInstructionOnly = instructionWords.some((word) => lowerLine.includes(word))
    && !hasMedicineForm
    && !hasDosageUnit

  return !isInstructionOnly && (hasMedicineForm || hasDosageUnit || (hasListMarker && hasDoseSchedule))
}

function LabPage() {
  const [appointments, setAppointments] = useState([])
  const [searchToken, setSearchToken] = useState('')
  const [activePatientId, setActivePatientId] = useState(null)
  
  const [medicinesGiven, setMedicinesGiven] = useState(false)
  const [itemAmounts, setItemAmounts] = useState({})
  const [customItems, setCustomItems] = useState([])

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
    setCustomItems([])
  }

  const prescriptionLines = useMemo(() => {
    return activePatient?.prescription ? activePatient.prescription.split('\n').filter(line => line.trim()) : []
  }, [activePatient])

  const medicineLineIndexes = useMemo(() => {
    return new Set(
      prescriptionLines
        .map((line, index) => (isPrescriptionMedicineLine(line) ? index : null))
        .filter((index) => index !== null),
    )
  }, [prescriptionLines])

  const totalBill = useMemo(() => {
    const prescTotal = Object.entries(itemAmounts).reduce((sum, [index, val]) => {
      if (!medicineLineIndexes.has(Number(index))) return sum
      return sum + (Number(val) || 0)
    }, 0)
    const customTotal = customItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    return prescTotal + customTotal
  }, [itemAmounts, customItems, medicineLineIndexes])

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
    setCustomItems([])
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
                {prescriptionLines.length > 0 ? prescriptionLines.map((line, i) => {
                  const isMedicine = medicineLineIndexes.has(i)
                  return (
                  <div className="lab-presc-item" key={i}>
                    <span className="lab-presc-text" style={{ color: isMedicine ? '#fff' : '#a3a3a3' }}>{line}</span>
                    {isMedicine && (
                      <div className="lab-presc-amount">
                      <span>₹</span>
                      <input 
                        type="number" 
                        placeholder="0"
                        value={itemAmounts[i] || ''}
                        onChange={(e) => handleAmountChange(i, e.target.value)}
                      />
                      </div>
                    )}
                  </div>
                )}) : (
                  <p className="lab-empty">No prescription details provided.</p>
                )}
              </div>
            </div>

            <div className="lab-section lab-actions-section">
              <h3>Pharmacy & Billing</h3>
              
              <label className="lab-checkbox-label" style={{ marginBottom: '16px' }}>
                <input 
                  type="checkbox" 
                  checked={medicinesGiven}
                  onChange={(e) => setMedicinesGiven(e.target.checked)}
                />
                Mark Medicines as Given / Available
              </label>

              <div className="lab-custom-items" style={{ marginBottom: '24px' }}>
                <h4 style={{ color: '#e2e8f0', marginBottom: '12px', fontSize: '15px' }}>Additional Billing Items</h4>
                {customItems.map((item, index) => (
                  <div className="lab-presc-item" key={item.id} style={{ marginBottom: '8px' }}>
                    <input 
                      type="text"
                      className="lab-custom-name"
                      placeholder="Item name (e.g., Syringe, Test)"
                      value={item.name}
                      onChange={(e) => {
                        const newItems = [...customItems]
                        newItems[index].name = e.target.value
                        setCustomItems(newItems)
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', outline: 'none', flex: 1, paddingRight: '16px' }}
                    />
                    <div className="lab-presc-amount">
                      <span>₹</span>
                      <input 
                        type="number" 
                        placeholder="0"
                        value={item.amount}
                        onChange={(e) => {
                          const newItems = [...customItems]
                          newItems[index].amount = e.target.value
                          setCustomItems(newItems)
                        }}
                      />
                    </div>
                    <button 
                      onClick={() => setCustomItems(customItems.filter(c => c.id !== item.id))}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '20px', cursor: 'pointer', marginLeft: '8px' }}
                    >×</button>
                  </div>
                ))}
                <button 
                  onClick={() => setCustomItems([...customItems, { id: Date.now(), name: '', amount: '' }])}
                  style={{ background: 'transparent', border: '1px dashed #404040', color: '#a3a3a3', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', width: '100%', fontSize: '14px', marginTop: '8px' }}
                >
                  + Add Custom Item
                </button>
              </div>

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

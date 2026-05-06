import { useEffect, useMemo, useState } from 'react'
import { onValue, ref as databaseRef } from 'firebase/database'
import { database } from '../lib/firebase.jsx'
import './FirstMobilePage.css'

const languages = [
  { id: 'en', label: 'English', code: 'EN', htmlLang: 'en' },
  { id: 'hi', label: 'हिंदी', code: 'HI', htmlLang: 'hi' },
  { id: 'ml', label: 'മലയാളം', code: 'ML', htmlLang: 'ml' },
  { id: 'ta', label: 'தமிழ்', code: 'TA', htmlLang: 'ta' },
]

const translations = {
  en: {
    clinic: 'City Health Clinic',
    selectLanguage: 'Select language',
    selectDepartment: 'Select department',
    next: 'Next',
    helper: 'Scan QR from reception or enter OPD number',
    departmentLabel: 'OUTPATIENT DEPARTMENTS',
    noDepartments: 'No departments available',
    noDepartmentsHelp: 'Please wait until the clinic adds doctors.',
    loadingDepartments: 'Loading departments...',
  },
  hi: {
    clinic: 'सिटी हेल्थ क्लिनिक',
    selectLanguage: 'भाषा चुनें',
    selectDepartment: 'विभाग चुनें',
    next: 'आगे',
    helper: 'रिसेप्शन से QR स्कैन करें या OPD नंबर दर्ज करें',
    departmentLabel: 'आउटपेशेंट विभाग',
    noDepartments: 'कोई विभाग उपलब्ध नहीं',
    noDepartmentsHelp: 'क्लिनिक द्वारा डॉक्टर जोड़ने तक प्रतीक्षा करें.',
    loadingDepartments: 'विभाग लोड हो रहे हैं...',
  },
  ml: {
    clinic: 'സിറ്റി ഹെൽത്ത് ക്ലിനിക്',
    selectLanguage: 'ഭാഷ തിരഞ്ഞെടുക്കുക',
    selectDepartment: 'വിഭാഗം തിരഞ്ഞെടുക്കുക',
    next: 'അടുത്തത്',
    helper: 'റിസപ്ഷനിൽ നിന്ന് QR സ്കാൻ ചെയ്യുക അല്ലെങ്കിൽ OPD നമ്പർ നൽകുക',
    departmentLabel: 'ഔട്ട്പേഷ്യന്റ് വിഭാഗങ്ങൾ',
    noDepartments: 'വിഭാഗങ്ങൾ ലഭ്യമല്ല',
    noDepartmentsHelp: 'ക്ലിനിക് ഡോക്ടർമാരെ ചേർക്കുന്നതുവരെ കാത്തിരിക്കുക.',
    loadingDepartments: 'വിഭാഗങ്ങൾ ലോഡ് ചെയ്യുന്നു...',
  },
  ta: {
    clinic: 'சிட்டி ஹெல்த் கிளினிக்',
    selectLanguage: 'மொழியைத் தேர்ந்தெடுக்கவும்',
    selectDepartment: 'துறையைத் தேர்ந்தெடுக்கவும்',
    next: 'அடுத்து',
    helper: 'ரிசப்ஷனில் இருந்து QR ஸ்கேன் செய்யவும் அல்லது OPD எண்ணை உள்ளிடவும்',
    departmentLabel: 'வெளிநோயாளர் துறைகள்',
    noDepartments: 'துறைகள் இல்லை',
    noDepartmentsHelp: 'கிளினிக் மருத்துவர்களைச் சேர்க்கும் வரை காத்திருக்கவும்.',
    loadingDepartments: 'துறைகள் ஏற்றப்படுகின்றன...',
  },
}

const departmentDescriptions = {
  'General OPD': 'General physician',
  Paediatrics: 'Children · 0-18 yrs',
  Pediatrics: 'Children · 0-18 yrs',
  Gynaecology: "Women's health",
  Gynecology: "Women's health",
  Orthopaedics: 'Bone & joint',
  Orthopedics: 'Bone & joint',
  ENT: 'Ear, nose & throat',
  Dermatology: 'Skin care',
}

const storageKey = 'carequeue-language'

function getInitialLanguage() {
  if (typeof window === 'undefined') {
    return 'en'
  }

  try {
    const savedLanguage = window.localStorage.getItem(storageKey)
    if (savedLanguage && translations[savedLanguage]) {
      return savedLanguage
    }
  } catch {
    return 'en'
  }

  const deviceLanguage = window.navigator.language.slice(0, 2).toLowerCase()
  return translations[deviceLanguage] ? deviceLanguage : 'en'
}

function getDeviceTime() {
  const parts = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(new Date())

  const hour = parts.find((part) => part.type === 'hour')?.value ?? '12'
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'
  return `${hour}:${minute}`
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

function mapDoctors(snapshot) {
  const doctors = snapshot.val()

  if (!doctors) {
    return []
  }

  return Object.entries(doctors).map(([id, doctor]) => ({ id, ...doctor }))
}

function groupDepartments(doctors) {
  const departments = new Map()

  doctors.forEach((doctor) => {
    const name = doctor.department?.trim()

    if (!name) {
      return
    }

    const current = departments.get(name) ?? {
      id: name,
      name,
      doctors: 0,
      waiting: 0,
      totalAppointments: 0,
      slotMinutes: [],
    }

    current.doctors += 1
    current.totalAppointments += Number(doctor.appointmentsPerDay) || 0
    current.slotMinutes.push(
      getAverageSlotMinutes(doctor.startTime, doctor.endTime, doctor.appointmentsPerDay),
    )

    departments.set(name, current)
  })

  return Array.from(departments.values()).map((department) => ({
    ...department,
    averageWait: Math.max(
      5,
      Math.round(
        department.slotMinutes.reduce((total, minutes) => total + minutes, 0) /
          department.slotMinutes.length,
      ),
    ),
  }))
}

function FirstMobilePage() {
  const [selectedLanguage, setSelectedLanguage] = useState(getInitialLanguage)
  const [time, setTime] = useState(getDeviceTime)
  const [screen, setScreen] = useState('language')
  const [doctors, setDoctors] = useState([])
  const [isDepartmentsLoading, setIsDepartmentsLoading] = useState(true)
  const [departmentsError, setDepartmentsError] = useState('')

  const activeLanguage = useMemo(
    () => languages.find((language) => language.id === selectedLanguage) ?? languages[0],
    [selectedLanguage],
  )

  const text = translations[selectedLanguage] ?? translations.en
  const departments = useMemo(() => groupDepartments(doctors), [doctors])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTime(getDeviceTime())
    }, 15000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const unsubscribe = onValue(
      databaseRef(database, 'doctors'),
      (snapshot) => {
        setDoctors(mapDoctors(snapshot))
        setIsDepartmentsLoading(false)
        setDepartmentsError('')
      },
      (firebaseError) => {
        setDepartmentsError(firebaseError.message)
        setIsDepartmentsLoading(false)
      },
    )

    return unsubscribe
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, selectedLanguage)
    } catch {
      // Language still changes for the current session when storage is unavailable.
    }

    document.documentElement.lang = activeLanguage.htmlLang
  }, [activeLanguage.htmlLang, selectedLanguage])

  return (
    <main className="carequeue-app" aria-label="CareQueue welcome screen">
      <section
        className={`carequeue-phone ${
          screen === 'departments' ? 'carequeue-phone-departments' : ''
        }`}
      >
        {screen === 'language' ? (
          <>
            <div className="carequeue-status" aria-label={`Current time ${time}`}>
              {time}
            </div>

            <div className="carequeue-brand">
              <div className="carequeue-logo" aria-hidden="true">
                <span className="carequeue-plus"></span>
              </div>

              <h1 className="carequeue-title">CareQueue</h1>
              <p className="carequeue-clinic">{text.clinic}</p>
            </div>

            <div className="carequeue-language-panel">
              <p className="carequeue-language-label">{text.selectLanguage}</p>
              <div className="carequeue-language-list">
                {languages.map((language) => {
                  const isSelected = language.id === selectedLanguage

                  return (
                    <button
                      type="button"
                      className="carequeue-language-button"
                      aria-pressed={isSelected}
                      key={language.id}
                      lang={language.htmlLang}
                      onClick={() => setSelectedLanguage(language.id)}
                    >
                      <span>{language.label}</span>
                      <abbr title={language.label}>{language.code}</abbr>
                    </button>
                  )
                })}
              </div>

              <button
                className="carequeue-next-button"
                type="button"
                onClick={() => setScreen('departments')}
              >
                {text.next}
              </button>
            </div>

            <p className="carequeue-helper">{text.helper}</p>
          </>
        ) : (
          <DepartmentSelection
            departments={departments}
            error={departmentsError}
            isLoading={isDepartmentsLoading}
            text={text}
            time={time}
          />
        )}
      </section>
    </main>
  )
}

function DepartmentSelection({ departments, error, isLoading, text, time }) {
  return (
    <div className="department-page">
      <header className="department-hero">
        <div className="department-status">{time}</div>
        <h1>{text.clinic}</h1>
        <p>{text.selectDepartment}</p>
      </header>

      <section className="department-content">
        <p className="department-eyebrow">{text.departmentLabel}</p>

        {error && <p className="department-message">{error}</p>}

        {isLoading ? (
          <p className="department-message">{text.loadingDepartments}</p>
        ) : departments.length === 0 ? (
          <div className="department-empty">
            <h2>{text.noDepartments}</h2>
            <p>{text.noDepartmentsHelp}</p>
          </div>
        ) : (
          <div className="department-list">
            {departments.map((department) => (
              <button className="department-card" key={department.id} type="button">
                <span>
                  <strong>{department.name}</strong>
                  <em>
                    {departmentDescriptions[department.name] ?? `${department.doctors} doctors`} ·{' '}
                    {department.waiting} waiting
                  </em>
                </span>
                <b data-speed={department.averageWait > 25 ? 'slow' : 'normal'}>
                  ~{department.averageWait} min
                </b>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default FirstMobilePage

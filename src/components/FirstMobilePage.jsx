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
    chooseDoctor: 'Choose your doctor',
    next: 'Next',
    helper: 'Scan QR from reception or enter OPD number',
    departmentLabel: 'OUTPATIENT DEPARTMENTS',
    noDepartments: 'No departments available',
    noDepartmentsHelp: 'Please wait until the clinic adds doctors.',
    loadingDepartments: 'Loading departments...',
    availableToday: 'AVAILABLE TODAY',
    unavailableToday: 'UNAVAILABLE TODAY',
    noDoctors: 'No doctors available',
    skipDoctorChoice: 'Or skip doctor choice',
    nextAvailableDoctor: 'Next available doctor',
    shortestWait: 'System assigns shortest wait automatically',
    patientsAhead: 'patients ahead',
    onLeave: 'On leave today',
    availableFrom: 'Available from',
  },
  hi: {
    clinic: 'सिटी हेल्थ क्लिनिक',
    selectLanguage: 'भाषा चुनें',
    selectDepartment: 'विभाग चुनें',
    chooseDoctor: 'अपना डॉक्टर चुनें',
    next: 'आगे',
    helper: 'रिसेप्शन से QR स्कैन करें या OPD नंबर दर्ज करें',
    departmentLabel: 'आउटपेशेंट विभाग',
    noDepartments: 'कोई विभाग उपलब्ध नहीं',
    noDepartmentsHelp: 'क्लिनिक द्वारा डॉक्टर जोड़ने तक प्रतीक्षा करें.',
    loadingDepartments: 'विभाग लोड हो रहे हैं...',
    availableToday: 'आज उपलब्ध',
    unavailableToday: 'आज उपलब्ध नहीं',
    noDoctors: 'कोई डॉक्टर उपलब्ध नहीं',
    skipDoctorChoice: 'या डॉक्टर चुनना छोड़ें',
    nextAvailableDoctor: 'अगला उपलब्ध डॉक्टर',
    shortestWait: 'सिस्टम सबसे कम प्रतीक्षा समय चुनेगा',
    patientsAhead: 'मरीज आगे',
    onLeave: 'आज छुट्टी पर',
    availableFrom: 'उपलब्ध समय',
  },
  ml: {
    clinic: 'സിറ്റി ഹെൽത്ത് ക്ലിനിക്',
    selectLanguage: 'ഭാഷ തിരഞ്ഞെടുക്കുക',
    selectDepartment: 'വിഭാഗം തിരഞ്ഞെടുക്കുക',
    chooseDoctor: 'ഡോക്ടറെ തിരഞ്ഞെടുക്കുക',
    next: 'അടുത്തത്',
    helper: 'റിസപ്ഷനിൽ നിന്ന് QR സ്കാൻ ചെയ്യുക അല്ലെങ്കിൽ OPD നമ്പർ നൽകുക',
    departmentLabel: 'ഔട്ട്പേഷ്യന്റ് വിഭാഗങ്ങൾ',
    noDepartments: 'വിഭാഗങ്ങൾ ലഭ്യമല്ല',
    noDepartmentsHelp: 'ക്ലിനിക് ഡോക്ടർമാരെ ചേർക്കുന്നതുവരെ കാത്തിരിക്കുക.',
    loadingDepartments: 'വിഭാഗങ്ങൾ ലോഡ് ചെയ്യുന്നു...',
    availableToday: 'ഇന്ന് ലഭ്യമാണ്',
    unavailableToday: 'ഇന്ന് ലഭ്യമല്ല',
    noDoctors: 'ഡോക്ടർമാർ ലഭ്യമല്ല',
    skipDoctorChoice: 'അല്ലെങ്കിൽ ഡോക്ടർ തിരഞ്ഞെടുക്കൽ ഒഴിവാക്കുക',
    nextAvailableDoctor: 'അടുത്ത ലഭ്യമായ ഡോക്ടർ',
    shortestWait: 'സിസ്റ്റം കുറഞ്ഞ കാത്തിരിപ്പ് സമയം തിരഞ്ഞെടുക്കും',
    patientsAhead: 'രോഗികൾ മുന്നിൽ',
    onLeave: 'ഇന്ന് അവധി',
    availableFrom: 'ലഭ്യമാകുന്ന സമയം',
  },
  ta: {
    clinic: 'சிட்டி ஹெல்த் கிளினிக்',
    selectLanguage: 'மொழியைத் தேர்ந்தெடுக்கவும்',
    selectDepartment: 'துறையைத் தேர்ந்தெடுக்கவும்',
    chooseDoctor: 'மருத்துவரைத் தேர்ந்தெடுக்கவும்',
    next: 'அடுத்து',
    helper: 'ரிசப்ஷனில் இருந்து QR ஸ்கேன் செய்யவும் அல்லது OPD எண்ணை உள்ளிடவும்',
    departmentLabel: 'வெளிநோயாளர் துறைகள்',
    noDepartments: 'துறைகள் இல்லை',
    noDepartmentsHelp: 'கிளினிக் மருத்துவர்களைச் சேர்க்கும் வரை காத்திருக்கவும்.',
    loadingDepartments: 'துறைகள் ஏற்றப்படுகின்றன...',
    availableToday: 'இன்று கிடைக்கும்',
    unavailableToday: 'இன்று கிடைக்காது',
    noDoctors: 'மருத்துவர் இல்லை',
    skipDoctorChoice: 'அல்லது மருத்துவர் தேர்வைத் தவிர்க்கவும்',
    nextAvailableDoctor: 'அடுத்த கிடைக்கும் மருத்துவர்',
    shortestWait: 'குறைந்த காத்திருப்பு நேரத்தை சிஸ்டம் தேர்வு செய்யும்',
    patientsAhead: 'நோயாளிகள் முன்னால்',
    onLeave: 'இன்று விடுப்பு',
    availableFrom: 'கிடைக்கும் நேரம்',
  },
}

const departmentDescriptions = {
  'General OPD': 'General physician',
  Paediatrics: 'Children - 0-18 yrs',
  Pediatrics: 'Children - 0-18 yrs',
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

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function getDoctorWait(doctor) {
  return Number(doctor.waiting) || 0
}

function isDoctorAvailable(doctor) {
  return (doctor.status ?? 'Consulting') === 'Consulting'
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
    current.waiting += getDoctorWait(doctor)
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
  const [selectedDepartment, setSelectedDepartment] = useState(null)
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
          screen !== 'language' ? 'carequeue-phone-departments' : ''
        }`}
      >
        {screen === 'language' ? (
          <LanguageSelection
            activeLanguage={activeLanguage}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
            setScreen={setScreen}
            text={text}
            time={time}
          />
        ) : screen === 'departments' ? (
          <DepartmentSelection
            departments={departments}
            error={departmentsError}
            isLoading={isDepartmentsLoading}
            onSelectDepartment={(department) => {
              setSelectedDepartment(department)
              setScreen('doctors')
            }}
            text={text}
            time={time}
          />
        ) : (
          <DoctorSelection
            department={selectedDepartment}
            doctors={doctors}
            text={text}
            time={time}
          />
        )}
      </section>
    </main>
  )
}

function LanguageSelection({
  activeLanguage,
  selectedLanguage,
  setSelectedLanguage,
  setScreen,
  text,
  time,
}) {
  return (
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
          lang={activeLanguage.htmlLang}
          onClick={() => setScreen('departments')}
        >
          {text.next}
        </button>
      </div>

      <p className="carequeue-helper">{text.helper}</p>
    </>
  )
}

function DepartmentSelection({ departments, error, isLoading, onSelectDepartment, text, time }) {
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
              <button
                className="department-card"
                key={department.id}
                type="button"
                onClick={() => onSelectDepartment(department)}
              >
                <span>
                  <strong>{department.name}</strong>
                  <em>
                    {departmentDescriptions[department.name] ?? `${department.doctors} doctors`} -{' '}
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

function DoctorSelection({ department, doctors, text, time }) {
  const departmentDoctors = doctors.filter((doctor) => doctor.department === department?.name)
  const availableDoctors = departmentDoctors.filter(isDoctorAvailable)
  const unavailableDoctors = departmentDoctors.filter((doctor) => !isDoctorAvailable(doctor))

  return (
    <div className="doctor-choice-page">
      <header className="department-hero">
        <div className="department-status">{time}</div>
        <h1>{department?.name ?? text.selectDepartment}</h1>
        <p>{text.chooseDoctor}</p>
      </header>

      <section className="doctor-choice-content">
        <p className="department-eyebrow">{text.availableToday}</p>

        {availableDoctors.length === 0 ? (
          <p className="department-message">{text.noDoctors}</p>
        ) : (
          <div className="doctor-choice-list">
            {availableDoctors.map((doctor) => (
              <DoctorChoiceCard doctor={doctor} key={doctor.id} text={text} />
            ))}
          </div>
        )}

        {unavailableDoctors.length > 0 && (
          <>
            <p className="department-eyebrow doctor-choice-section-title">{text.unavailableToday}</p>
            <div className="doctor-choice-list">
              {unavailableDoctors.map((doctor) => (
                <DoctorChoiceCard doctor={doctor} isUnavailable key={doctor.id} text={text} />
              ))}
            </div>
          </>
        )}

        <p className="doctor-choice-skip-label">{text.skipDoctorChoice}</p>
        <button className="doctor-choice-skip" type="button">
          <strong>{text.nextAvailableDoctor}</strong>
          <span>{text.shortestWait}</span>
        </button>
      </section>
    </div>
  )
}

function DoctorChoiceCard({ doctor, isUnavailable = false, text }) {
  const waitMinutes = getAverageSlotMinutes(doctor.startTime, doctor.endTime, doctor.appointmentsPerDay)
  const waitCount = getDoctorWait(doctor)

  return (
    <button className="doctor-choice-card" disabled={isUnavailable} type="button">
      <div className="doctor-choice-avatar">{getInitials(doctor.name || 'Doctor')}</div>
      <span className="doctor-choice-info">
        <strong>{doctor.name}</strong>
        <em>{doctor.department}</em>
        <small>
          {isUnavailable
            ? doctor.availableFrom
              ? `${text.availableFrom} ${doctor.availableFrom}`
              : text.onLeave
            : `${waitCount} ${text.patientsAhead}`}
        </small>
      </span>
      {!isUnavailable && <b>~{waitMinutes} min</b>}
    </button>
  )
}

export default FirstMobilePage

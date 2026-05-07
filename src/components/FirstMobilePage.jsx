import { useEffect, useMemo, useState } from 'react'
import {
  get,
  onValue,
  push,
  ref as databaseRef,
  runTransaction,
  serverTimestamp,
  set as setDatabaseValue,
} from 'firebase/database'
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
    bookAppointment: 'Book appointment',
    selectDate: 'SELECT DATE',
    availableSlots: 'AVAILABLE SLOTS',
    selected: 'Selected',
    noLiveSlots: 'No live slots available now',
    confirmAppointment: 'Confirm appointment',
    walkInToken: 'Get walk-in token instead',
    tokenIssued: 'Token issued',
    tokenNumber: 'TOKEN NUMBER',
    ahead: 'Ahead',
    wait: 'Wait',
    serving: 'Serving',
    doctor: 'Doctor',
    department: 'Department',
    counter: 'Counter',
    prescription: 'Prescription',
    digitalCopySent: 'Digital copy sent',
    smsAlerts: 'SMS alerts on',
    qrCounter: 'QR for counter',
    pharmacyLinked: 'Pharmacy linked',
    shareFamily: 'Share with family',
    shareCopied: 'Token details copied',
    shareShared: 'Shared',
    shareFailed: 'Share not available',
    openLiveQueue: 'Open live queue',
    liveQueue: 'Live queue',
    yourToken: 'YOUR TOKEN',
    inConsult: 'In consult',
    queueProgress: 'Queue progress',
    prepareConsultation: 'Prepare for consultation',
    consultationReady:
      'Please have your previous prescriptions and reports ready. Proceed to the waiting area outside {counter}.',
    delayTurn: 'I need more time - delay my turn',
    home: 'Home',
    appts: 'Appts',
    records: 'Records',
    notifications: 'Notifications',
    bookings: 'Bookings',
    noBookings: 'No bookings yet',
    noNotifications: 'No notifications yet',
    latestUpdate: 'Latest update',
    viewToken: 'View token',
    logout: 'Log out',
    bookedFor: 'Booked for',
    chooseDoctorFirst: 'Choose a doctor to book an appointment.',
    loginRegister: 'Register / Login',
    mobileNumber: 'Mobile number',
    mobilePlaceholder: 'Enter 10-digit mobile',
    fullName: 'Full name',
    fullNamePlaceholder: 'Patient name',
    login: 'Login',
    register: 'Register',
    loginHelp: 'Use your registered mobile number to continue.',
    registerHelp: 'Create your patient profile with a mobile number.',
    mobileInvalid: 'Enter a valid 10-digit mobile number.',
    nameRequired: 'Enter patient name to register.',
    userNotFound: 'No patient found with this mobile number. Please register.',
    userAlreadyExists: 'This mobile number is already registered. Please login.',
    authFailed: 'Could not continue. Please try again.',
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
    bookAppointment: 'अपॉइंटमेंट बुक करें',
    selectDate: 'तारीख चुनें',
    availableSlots: 'उपलब्ध स्लॉट',
    selected: 'चयनित',
    confirmAppointment: 'अपॉइंटमेंट पुष्टि करें',
    walkInToken: 'वॉक-इन टोकन लें',
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
    bookAppointment: 'അപ്പോയിന്റ്മെന്റ് ബുക്ക് ചെയ്യുക',
    selectDate: 'തീയതി തിരഞ്ഞെടുക്കുക',
    availableSlots: 'ലഭ്യമായ സ്ലോട്ടുകൾ',
    selected: 'തിരഞ്ഞെടുത്തു',
    confirmAppointment: 'അപ്പോയിന്റ്മെന്റ് സ്ഥിരീകരിക്കുക',
    walkInToken: 'വാക്ക്-ഇൻ ടോക്കൺ നേടുക',
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
    bookAppointment: 'அப்பாயிண்ட்மெண்ட் பதிவு செய்யவும்',
    selectDate: 'தேதியைத் தேர்ந்தெடுக்கவும்',
    availableSlots: 'கிடைக்கும் நேரங்கள்',
    selected: 'தேர்ந்தெடுக்கப்பட்டது',
    confirmAppointment: 'அப்பாயிண்ட்மெண்ட் உறுதி செய்யவும்',
    walkInToken: 'வாக்-இன் டோக்கன் பெறவும்',
    tokenIssued: 'டோக்கன் வழங்கப்பட்டது',
    tokenNumber: 'டோக்கன் எண்',
    ahead: 'முன்னால்',
    wait: 'காத்திருப்பு',
    serving: 'சேவை',
    doctor: 'மருத்துவர்',
    department: 'துறை',
    counter: 'கவுண்டர்',
    prescription: 'மருந்துச்சீட்டு',
    digitalCopySent: 'டிஜிட்டல் நகல் அனுப்பப்பட்டது',
    smsAlerts: 'SMS அறிவிப்புகள் ஆன்',
    qrCounter: 'கவுண்டருக்கான QR',
    pharmacyLinked: 'பார்மசி இணைக்கப்பட்டது',
    shareFamily: 'குடும்பத்துடன் பகிரவும்',
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
const userStorageKey = 'carequeue-user'

function normalizeMobileInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  const localDigits = digits.length > 10 && digits.startsWith('91') ? digits.slice(2) : digits
  return localDigits.slice(0, 10)
}

function formatMobileNumber(mobile) {
  const digits = normalizeMobileInput(mobile)

  if (digits.length !== 10) {
    return digits
  }

  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
}

function getInitialUser() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const savedUser = JSON.parse(window.localStorage.getItem(userStorageKey) ?? 'null')

    if (savedUser?.mobile && normalizeMobileInput(savedUser.mobile).length === 10) {
      return {
        id: savedUser.id ?? normalizeMobileInput(savedUser.mobile),
        name: savedUser.name ?? '',
        mobile: normalizeMobileInput(savedUser.mobile),
      }
    }
  } catch {
    return null
  }

  return null
}

function saveUserSession(user) {
  try {
    window.localStorage.setItem(userStorageKey, JSON.stringify(user))
  } catch {
    // The current session still works when local storage is unavailable.
  }
}

function clearUserSession() {
  try {
    window.localStorage.removeItem(userStorageKey)
  } catch {
    // Logging out still resets the current app state when storage is unavailable.
  }
}

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

function parseTimeToMinutes(time) {
  if (!time) {
    return 9 * 60
  }

  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

function formatMinutesAsTime(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60) % 24
  const minute = totalMinutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function formatMinutesAs12Hour(totalMinutes) {
  const hour24 = Math.floor(totalMinutes / 60) % 24
  const minute = totalMinutes % 60
  const period = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 || 12
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`
}

function isSameCalendarDate(firstDate, secondDate) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  )
}

function getAppointmentSlots(doctor, selectedDate) {
  const startTotal = parseTimeToMinutes(doctor?.startTime)
  let endTotal = parseTimeToMinutes(doctor?.endTime)
  const maxSlots = Math.max(6, Math.min(14, Number(doctor?.appointmentsPerDay) || 8))

  if (endTotal <= startTotal) {
    endTotal += 24 * 60
  }

  const slotStep = Math.max(20, Math.floor((endTotal - startTotal) / maxSlots))
  const now = new Date()
  const nowTotal = now.getHours() * 60 + now.getMinutes()
  const waitingDelay = isSameCalendarDate(selectedDate, now) ? getDoctorWait(doctor) * slotStep : 0
  const liveStart = isSameCalendarDate(selectedDate, now)
    ? Math.max(startTotal, nowTotal) + waitingDelay
    : startTotal
  const firstSlotTotal = startTotal + Math.max(0, Math.ceil((liveStart - startTotal) / slotStep)) * slotStep
  const slots = []

  for (
    let slotTotal = firstSlotTotal;
    slots.length < maxSlots && slotTotal < endTotal;
    slotTotal += slotStep
  ) {
    const value = formatMinutesAsTime(slotTotal)
    slots.push({
      value,
      label: formatMinutesAs12Hour(slotTotal),
    })
  }

  return slots
}

function getMonthDays(baseDate) {
  const monthDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)
  const daysInMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate()
  const leadingBlanks = monthDate.getDay()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return [
    ...Array.from({ length: leadingBlanks }, (_, index) => ({ id: `blank-${index}` })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1
      const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), day)
      return {
        id: day,
        day,
        date,
        isSelectable: date >= today,
      }
    }),
  ]
}

function formatMonthTitle(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatSelectedDateTitle(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(date)
    .toUpperCase()
}

function getDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function parseDateKey(dateKey) {
  if (!dateKey) {
    return null
  }

  const [year, month, day] = String(dateKey).split('-').map(Number)

  if (!year || !month || !day) {
    return null
  }

  return new Date(year, month - 1, day)
}

function formatDateKeyTitle(dateKey) {
  const date = parseDateKey(dateKey)

  if (!date) {
    return 'Today'
  }

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function getAppointmentSortTime(appointment) {
  const issuedAt = Number(appointment?.issuedAt) || Number(appointment?.createdAt)

  if (issuedAt) {
    return issuedAt
  }

  return parseDateKey(appointment?.dateKey)?.getTime() ?? 0
}

function getTokenPrefix(doctor) {
  const source = `${doctor?.department ?? ''}${doctor?.name ?? ''}`
  return source.match(/[A-Za-z]/)?.[0]?.toUpperCase() ?? 'T'
}

function getTokenNumber(doctor, sequence) {
  return `${getTokenPrefix(doctor)}-${String(Number(sequence) || 1).padStart(3, '0')}`
}

function getTokenSequence(token) {
  const sequence = String(token ?? '').match(/\d+$/)?.[0]
  return Number(sequence) || 0
}

function getDoctorCounter(doctor) {
  if (doctor?.counter) {
    return doctor.counter
  }

  if (doctor?.counterName) {
    return doctor.counterName
  }

  const source = doctor?.id ?? doctor?.name ?? 'doctor'
  const counterNumber =
    (Array.from(source).reduce((total, letter) => total + letter.charCodeAt(0), 0) % 4) + 1
  return `Counter ${counterNumber}`
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const copyArea = document.createElement('textarea')
  copyArea.value = text
  copyArea.setAttribute('readonly', '')
  copyArea.style.position = 'fixed'
  copyArea.style.opacity = '0'
  document.body.append(copyArea)
  copyArea.select()
  document.execCommand('copy')
  copyArea.remove()
}

function isActiveAppointment(appointment) {
  const status = String(appointment?.status ?? 'waiting').toLowerCase()
  return !['completed', 'done', 'cancelled', 'canceled', 'skipped', 'no-show'].includes(status)
}

function compareAppointments(firstAppointment, secondAppointment) {
  const firstSequence = Number(firstAppointment.sequence) || Number.MAX_SAFE_INTEGER
  const secondSequence = Number(secondAppointment.sequence) || Number.MAX_SAFE_INTEGER

  if (firstSequence !== secondSequence) {
    return firstSequence - secondSequence
  }

  return (Number(firstAppointment.createdAt) || 0) - (Number(secondAppointment.createdAt) || 0)
}

function getDoctorQueue(doctor, appointments, dateKey) {
  if (!doctor?.id) {
    return []
  }

  return appointments
    .filter(
      (appointment) =>
        appointment.doctorId === doctor.id &&
        appointment.dateKey === dateKey &&
        isActiveAppointment(appointment),
    )
    .sort(compareAppointments)
}

function getCompletedCount(doctor, appointments, dateKey) {
  if (!doctor?.id) {
    return 0
  }

  return appointments.filter(
    (appointment) =>
      appointment.doctorId === doctor.id &&
      appointment.dateKey === dateKey &&
      String(appointment.status ?? '').toLowerCase() === 'completed',
  ).length
}

function mapAppointments(snapshot) {
  const appointments = snapshot.val()

  if (!appointments) {
    return []
  }

  return Object.entries(appointments)
    .map(([id, appointment]) => ({ id, ...appointment }))
    .sort(compareAppointments)
}

function enrichDoctorsWithLiveQueues(doctors, appointments, dateKey) {
  return doctors.map((doctor) => {
    const queue = getDoctorQueue(doctor, appointments, dateKey)
    const completedCount = getCompletedCount(doctor, appointments, dateKey)

    return {
      ...doctor,
      seen: Number(doctor.seen) || completedCount,
      servingToken: doctor.servingToken || doctor.currentToken || queue[0]?.token || '',
      waiting: queue.length,
    }
  })
}

function getLiveQueueStatus({ appointment, appointments = [], doctor }) {
  const liveAppointment =
    appointments.find((currentAppointment) => currentAppointment.id === appointment?.id) ??
    appointment
  const appointmentDateKey = liveAppointment?.dateKey ?? getDateKey(new Date())
  const queue = getDoctorQueue(doctor, appointments, appointmentDateKey)
  const queueWithCurrent =
    liveAppointment && !queue.some((currentAppointment) => currentAppointment.id === liveAppointment.id)
      ? [...queue, liveAppointment].sort(compareAppointments)
      : queue
  const appointmentIndex = queueWithCurrent.findIndex(
    (currentAppointment) => currentAppointment.id === liveAppointment?.id,
  )
  const aheadCount =
    appointmentIndex >= 0 ? appointmentIndex : Number(liveAppointment?.aheadAtBooking) || 0
  const waitMinutes =
    appointmentIndex >= 0
      ? aheadCount *
        getAverageSlotMinutes(doctor?.startTime, doctor?.endTime, doctor?.appointmentsPerDay)
      : Number(liveAppointment?.estimatedWaitMinutes) || 0
  const token = liveAppointment?.token ?? getTokenNumber(doctor, liveAppointment?.sequence)
  const departmentName = liveAppointment?.department || doctor?.department || ''
  const doctorName = liveAppointment?.doctorName || doctor?.name || ''
  const counter = liveAppointment?.counter || getDoctorCounter(doctor)
  const servingAppointment = queueWithCurrent[0]
  const servingToken = servingAppointment?.token || doctor?.servingToken || token
  const tokenSequence = Number(liveAppointment?.sequence) || getTokenSequence(token)
  const servingSequence =
    Number(servingAppointment?.sequence) || getTokenSequence(servingToken) || tokenSequence
  const progressPercent =
    tokenSequence > 0
      ? Math.max(8, Math.min(100, Math.round((servingSequence / tokenSequence) * 100)))
      : aheadCount === 0
        ? 100
        : 18

  return {
    aheadCount,
    counter,
    departmentName,
    doctorName,
    liveAppointment,
    progressPercent,
    servingToken,
    token,
    waitMinutes,
  }
}

function isPatientAppointment(appointment, currentUser) {
  if (!currentUser) {
    return false
  }

  const patientMobile = normalizeMobileInput(appointment?.patientMobile)
  const currentMobile = normalizeMobileInput(currentUser.mobile)

  return (
    appointment?.patientId === currentUser.id ||
    (patientMobile.length === 10 && patientMobile === currentMobile)
  )
}

function getFooterTab(screen) {
  if (screen === 'booking') {
    return 'appts'
  }

  if (screen === 'token' || screen === 'queue') {
    return 'token'
  }

  if (screen === 'records') {
    return 'records'
  }

  return 'home'
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
  const savedUser = useMemo(() => getInitialUser(), [])
  const [selectedLanguage, setSelectedLanguage] = useState(getInitialLanguage)
  const [time, setTime] = useState(getDeviceTime)
  const [screen, setScreen] = useState(savedUser ? 'departments' : 'auth')
  const [currentUser, setCurrentUser] = useState(savedUser)
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [issuedAppointment, setIssuedAppointment] = useState(null)
  const [doctors, setDoctors] = useState([])
  const [appointments, setAppointments] = useState([])
  const [isDepartmentsLoading, setIsDepartmentsLoading] = useState(true)
  const [departmentsError, setDepartmentsError] = useState('')

  const activeLanguage = useMemo(
    () => languages.find((language) => language.id === selectedLanguage) ?? languages[0],
    [selectedLanguage],
  )

  const text = { ...translations.en, ...(translations[selectedLanguage] ?? {}) }
  const todayDateKey = getDateKey(new Date())
  const liveDoctors = useMemo(
    () => enrichDoctorsWithLiveQueues(doctors, appointments, todayDateKey),
    [appointments, doctors, todayDateKey],
  )
  const selectedLiveDoctor = useMemo(
    () => liveDoctors.find((doctor) => doctor.id === selectedDoctor?.id) ?? selectedDoctor,
    [liveDoctors, selectedDoctor],
  )
  const departments = useMemo(() => groupDepartments(liveDoctors), [liveDoctors])
  const patientAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => isPatientAppointment(appointment, currentUser))
        .sort((firstAppointment, secondAppointment) =>
          getAppointmentSortTime(secondAppointment) - getAppointmentSortTime(firstAppointment),
        ),
    [appointments, currentUser],
  )
  const activeAppointment = issuedAppointment ?? patientAppointments[0] ?? null
  const activeAppointmentDoctor = useMemo(
    () =>
      liveDoctors.find((doctor) => doctor.id === activeAppointment?.doctorId) ??
      selectedLiveDoctor,
    [activeAppointment?.doctorId, liveDoctors, selectedLiveDoctor],
  )
  const showFooter = screen !== 'auth' && screen !== 'language'
  const activeFooterTab = getFooterTab(screen)

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
    const unsubscribe = onValue(databaseRef(database, 'appointments'), (snapshot) => {
      setAppointments(mapAppointments(snapshot))
    })

    return unsubscribe
  }, [])

  function handleFooterNavigate(tab) {
    if (tab === 'home') {
      setScreen('departments')
      return
    }

    if (tab === 'token') {
      if (activeAppointment) {
        setScreen('token')
      }

      return
    }

    if (tab === 'appts') {
      setScreen(selectedLiveDoctor?.id ? 'booking' : 'departments')
      return
    }

    setScreen('records')
  }

  function handleLogout() {
    clearUserSession()
    setCurrentUser(null)
    setSelectedDepartment(null)
    setSelectedDoctor(null)
    setIssuedAppointment(null)
    setScreen('auth')
  }

  async function handleUserAuth({ mode, name, mobile }) {
    const normalizedMobile = normalizeMobileInput(mobile)
    const patientName = name.trim()

    if (normalizedMobile.length !== 10) {
      throw new Error(text.mobileInvalid)
    }

    if (mode === 'register' && !patientName) {
      throw new Error(text.nameRequired)
    }

    const patientReference = databaseRef(database, `patients/${normalizedMobile}`)
    const patientSnapshot = await get(patientReference)

    if (mode === 'login') {
      if (!patientSnapshot.exists()) {
        throw new Error(text.userNotFound)
      }

      const patient = patientSnapshot.val()
      const loggedInUser = {
        id: patient?.id ?? normalizedMobile,
        name: patient?.name ?? '',
        mobile: normalizedMobile,
      }

      setCurrentUser(loggedInUser)
      saveUserSession(loggedInUser)
      setScreen('departments')
      return
    }

    if (patientSnapshot.exists()) {
      throw new Error(text.userAlreadyExists)
    }

    const registeredUser = {
      id: normalizedMobile,
      name: patientName,
      mobile: normalizedMobile,
    }

    await setDatabaseValue(patientReference, {
      ...registeredUser,
      createdAt: serverTimestamp(),
    })

    setCurrentUser(registeredUser)
    saveUserSession(registeredUser)
    setScreen('departments')
  }

  async function handleConfirmAppointment(appointment) {
    if (!selectedLiveDoctor?.id) {
      throw new Error('Doctor details are not available')
    }

    const dateKey = appointment.dateKey
    const counterResult = await runTransaction(
      databaseRef(database, `queueCounters/${dateKey}/${selectedLiveDoctor.id}`),
      (currentSequence) => (Number(currentSequence) || 0) + 1,
    )

    if (!counterResult.committed) {
      throw new Error('Token could not be issued. Please try again.')
    }

    const sequence = Number(counterResult.snapshot.val()) || 1
    const token = getTokenNumber(selectedLiveDoctor, sequence)
    const counter = getDoctorCounter(selectedLiveDoctor)
    const queueAhead = getDoctorQueue(selectedLiveDoctor, appointments, dateKey).length
    const averageSlotMinutes = getAverageSlotMinutes(
      selectedLiveDoctor.startTime,
      selectedLiveDoctor.endTime,
      selectedLiveDoctor.appointmentsPerDay,
    )
    const appointmentRef = push(databaseRef(database, 'appointments'))
    const issuedAt = Date.now()
    const savedAppointment = {
      id: appointmentRef.key,
      doctorId: selectedLiveDoctor.id,
      doctorName: selectedLiveDoctor.name ?? '',
      department: selectedLiveDoctor.department ?? '',
      dateKey,
      slot: appointment.slot,
      slotValue: appointment.slotValue,
      token,
      sequence,
      counter,
      patientId: currentUser?.id ?? '',
      patientName: currentUser?.name ?? '',
      patientMobile: currentUser?.mobile ?? '',
      status: 'waiting',
      aheadAtBooking: queueAhead,
      estimatedWaitMinutes: queueAhead * averageSlotMinutes,
      issuedAt,
      createdAt: serverTimestamp(),
    }

    await setDatabaseValue(appointmentRef, savedAppointment)

    const localAppointment = { ...savedAppointment, createdAt: issuedAt }
    setIssuedAppointment(localAppointment)
    setScreen('token')
    return localAppointment
  }

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
          screen !== 'auth' && screen !== 'language' ? 'carequeue-phone-departments' : ''
        } ${showFooter ? 'carequeue-phone-tabbed' : ''}`}
      >
        {screen === 'auth' ? (
          <UserMobileAuth
            currentUser={currentUser}
            onContinue={handleUserAuth}
            text={text}
            time={time}
          />
        ) : screen === 'language' ? (
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
            onLogout={handleLogout}
            onSelectDepartment={(department) => {
              setSelectedDepartment(department)
              setScreen('doctors')
            }}
            text={text}
            time={time}
          />
        ) : screen === 'doctors' ? (
          <DoctorSelection
            department={selectedDepartment}
            doctors={liveDoctors}
            onChooseDoctor={(doctor) => {
              setSelectedDoctor(doctor)
              setScreen('booking')
            }}
            onBack={() => setScreen('departments')}
            text={text}
            time={time}
          />
        ) : screen === 'booking' ? (
          <BookingPage
            doctor={selectedLiveDoctor}
            onBack={() => setScreen('doctors')}
            onConfirm={handleConfirmAppointment}
            text={text}
            time={time}
          />
        ) : screen === 'token' ? (
          <TokenIssuedPage
            appointments={appointments}
            appointment={activeAppointment}
            doctor={activeAppointmentDoctor}
            onBack={() => setScreen('booking')}
            onOpenQueue={() => setScreen('queue')}
            text={text}
            time={time}
          />
        ) : screen === 'queue' ? (
          <LiveQueuePage
            appointments={appointments}
            appointment={activeAppointment}
            doctor={activeAppointmentDoctor}
            onBack={() => setScreen('token')}
            text={text}
            time={time}
          />
        ) : (
          <RecordsPage
            appointments={patientAppointments}
            allAppointments={appointments}
            currentUser={currentUser}
            doctors={liveDoctors}
            onLogout={handleLogout}
            onOpenAppointment={(appointment, doctor) => {
              setIssuedAppointment(appointment)
              setSelectedDoctor(doctor ?? null)
              setScreen('token')
            }}
            text={text}
            time={time}
          />
        )}

        {showFooter && (
          <FooterNav
            activeTab={activeFooterTab}
            hasAppointment={Boolean(activeAppointment)}
            onNavigate={handleFooterNavigate}
            text={text}
          />
        )}
      </section>
    </main>
  )
}

function UserMobileAuth({ currentUser, onContinue, text, time }) {
  const [mode, setMode] = useState(currentUser?.mobile ? 'login' : 'register')
  const [name, setName] = useState(currentUser?.name ?? '')
  const [mobile, setMobile] = useState(currentUser?.mobile ?? '')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isRegistering = mode === 'register'

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await onContinue({ mode, name, mobile })
    } catch (authError) {
      setError(authError.message || text.authFailed)
    } finally {
      setIsSubmitting(false)
    }
  }

  function selectMode(nextMode) {
    setMode(nextMode)
    setError('')
  }

  return (
    <>
      <div className="carequeue-status" aria-label={`Current time ${time}`}>
        {time}
      </div>

      <div className="carequeue-brand carequeue-auth-brand">
        <div className="carequeue-logo" aria-hidden="true">
          <span className="carequeue-plus"></span>
        </div>

        <h1 className="carequeue-title">CareQueue</h1>
        <p className="carequeue-clinic">{text.clinic}</p>
      </div>

      <form className="carequeue-auth-panel" onSubmit={handleSubmit}>
        <h2>{text.loginRegister}</h2>

        <div className="carequeue-auth-toggle" aria-label={text.loginRegister}>
          <button
            type="button"
            aria-pressed={mode === 'login'}
            onClick={() => selectMode('login')}
          >
            {text.login}
          </button>
          <button
            type="button"
            aria-pressed={isRegistering}
            onClick={() => selectMode('register')}
          >
            {text.register}
          </button>
        </div>

        <p className="carequeue-auth-copy">{isRegistering ? text.registerHelp : text.loginHelp}</p>

        {isRegistering && (
          <label className="carequeue-auth-field">
            <span>{text.fullName}</span>
            <input
              autoComplete="name"
              disabled={isSubmitting}
              onChange={(event) => setName(event.target.value)}
              placeholder={text.fullNamePlaceholder}
              type="text"
              value={name}
            />
          </label>
        )}

        <label className="carequeue-auth-field">
          <span>{text.mobileNumber}</span>
          <div className="carequeue-mobile-input">
            <b>+91</b>
            <input
              autoComplete="tel"
              disabled={isSubmitting}
              inputMode="numeric"
              maxLength={10}
              onChange={(event) => setMobile(normalizeMobileInput(event.target.value))}
              placeholder={text.mobilePlaceholder}
              type="tel"
              value={mobile}
            />
          </div>
        </label>

        {error && <p className="carequeue-auth-error">{error}</p>}

        <button className="carequeue-next-button carequeue-auth-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Please wait...' : isRegistering ? text.register : text.login}
        </button>
      </form>

      {currentUser?.mobile && (
        <p className="carequeue-helper">
          {currentUser.name ? `${currentUser.name} - ` : ''}
          {formatMobileNumber(currentUser.mobile)}
        </p>
      )}
    </>
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

function DepartmentSelection({ departments, error, isLoading, onLogout, onSelectDepartment, text, time }) {
  return (
    <div className="department-page">
      <header className="department-hero">
        <div className="department-hero-bar">
          <div className="department-status">{time}</div>
          <button
            className="department-logout-button"
            type="button"
            onClick={onLogout}
            aria-label={text.logout}
          >
            {text.logout}
          </button>
        </div>
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

function DoctorSelection({ department, doctors, onBack, onChooseDoctor, text, time }) {
  const departmentDoctors = doctors.filter((doctor) => doctor.department === department?.name)
  const availableDoctors = departmentDoctors.filter(isDoctorAvailable)
  const unavailableDoctors = departmentDoctors.filter((doctor) => !isDoctorAvailable(doctor))
  const nextAvailableDoctor = [...availableDoctors].sort(
    (first, second) => getDoctorWait(first) - getDoctorWait(second),
  )[0]

  return (
    <div className="doctor-choice-page">
      <header className="department-hero">
        <div className="department-hero-bar">
          <div className="department-status">{time}</div>
          <button className="department-back-button" type="button" onClick={onBack} aria-label="Go back">
            ←
          </button>
        </div>
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
              <DoctorChoiceCard
                doctor={doctor}
                key={doctor.id}
                onChooseDoctor={onChooseDoctor}
                text={text}
              />
            ))}
          </div>
        )}

        {unavailableDoctors.length > 0 && (
          <>
            <p className="department-eyebrow doctor-choice-section-title">{text.unavailableToday}</p>
            <div className="doctor-choice-list">
              {unavailableDoctors.map((doctor) => (
                <DoctorChoiceCard
                  doctor={doctor}
                  isUnavailable
                  key={doctor.id}
                  onChooseDoctor={onChooseDoctor}
                  text={text}
                />
              ))}
            </div>
          </>
        )}

        <p className="doctor-choice-skip-label">{text.skipDoctorChoice}</p>
        <button
          className="doctor-choice-skip"
          disabled={!nextAvailableDoctor}
          type="button"
          onClick={() => nextAvailableDoctor && onChooseDoctor(nextAvailableDoctor)}
        >
          <strong>{text.nextAvailableDoctor}</strong>
          <span>{text.shortestWait}</span>
        </button>
      </section>
    </div>
  )
}

function DoctorChoiceCard({ doctor, isUnavailable = false, onChooseDoctor, text }) {
  const waitMinutes = getAverageSlotMinutes(doctor.startTime, doctor.endTime, doctor.appointmentsPerDay)
  const waitCount = getDoctorWait(doctor)

  return (
    <button
      className="doctor-choice-card"
      disabled={isUnavailable}
      type="button"
      onClick={() => onChooseDoctor(doctor)}
    >
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

function BookingPage({ doctor, onBack, onConfirm, text, time }) {
  const today = useMemo(() => new Date(), [])
  const [selectedDate, setSelectedDate] = useState(today)
  const slots = useMemo(() => getAppointmentSlots(doctor, selectedDate), [doctor, selectedDate])
  const [selectedSlot, setSelectedSlot] = useState(() => slots[0]?.value)
  const [isBooking, setIsBooking] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const firstAvailableSlot = slots[0]
  const selectedSlotValue = slots.some((slot) => slot.value === selectedSlot)
    ? selectedSlot
    : firstAvailableSlot?.value
  const selectedSlotLabel =
    slots.find((slot) => slot.value === selectedSlotValue)?.label ?? firstAvailableSlot?.label ?? ''
  const monthDays = useMemo(() => getMonthDays(today), [today])

  async function handleConfirm() {
    if (!selectedSlotValue) {
      return
    }

    setIsBooking(true)
    setBookingError('')

    try {
      await onConfirm({
        dateKey: getDateKey(selectedDate),
        slot: selectedSlotLabel,
        slotValue: selectedSlotValue,
      })
    } catch (confirmError) {
      setBookingError(confirmError.message)
    } finally {
      setIsBooking(false)
    }
  }

  return (
    <div className="booking-page">
      <header className="department-hero booking-hero">
        <div className="department-hero-bar">
          <div className="department-status">{time}</div>
          <button className="department-back-button" type="button" onClick={onBack} aria-label="Go back">
            ←
          </button>
        </div>
        <h1>{text.bookAppointment}</h1>
        <p>
          {doctor?.name} · {doctor?.department}
        </p>
      </header>

      <section className="booking-content">
        <p className="department-eyebrow">
          {text.selectDate} — {formatMonthTitle(today)}
        </p>

        <div className="booking-calendar-weekdays" aria-hidden="true">
          <span>Su</span>
          <span>Mo</span>
          <span>Tu</span>
          <span>We</span>
          <span>Th</span>
          <span>Fr</span>
          <span>Sa</span>
        </div>

        <div className="booking-calendar">
          {monthDays.map((day) =>
            day.day ? (
              <button
                className="booking-day"
                data-selected={isSameCalendarDate(day.date, selectedDate)}
                data-available={day.isSelectable}
                disabled={!day.isSelectable}
                key={day.id}
                type="button"
                onClick={() => {
                  setSelectedDate(day.date)
                  setSelectedSlot(undefined)
                }}
              >
                {day.day}
              </button>
            ) : (
              <span key={day.id}></span>
            ),
          )}
        </div>

        <p className="department-eyebrow booking-slots-title">
          {text.availableSlots} · {formatSelectedDateTitle(selectedDate)}
        </p>

        {slots.length === 0 ? (
          <p className="department-message">{text.noLiveSlots}</p>
        ) : (
          <div className="booking-slots">
            {slots.map((slot) => (
              <button
                className="booking-slot"
                data-selected={slot.value === selectedSlotValue}
                key={slot.value}
                type="button"
                onClick={() => setSelectedSlot(slot.value)}
              >
                {slot.label}
              </button>
            ))}
          </div>
        )}

        <div className="booking-legend">
          <span>
            <i></i>
            {text.selected}
          </span>
        </div>

        <button
          className="booking-confirm"
          disabled={!selectedSlotValue || isBooking}
          type="button"
          onClick={handleConfirm}
        >
          {isBooking ? 'Issuing token...' : `${text.confirmAppointment} — ${selectedSlotLabel || '--'}`}
        </button>

        {bookingError && <p className="department-message booking-error">{bookingError}</p>}

        <button className="booking-walkin" type="button" disabled>
          {text.walkInToken}
        </button>
      </section>
    </div>
  )
}

function TokenIssuedPage({ appointment, appointments = [], doctor, onBack, onOpenQueue, text, time }) {
  const [shareStatus, setShareStatus] = useState('')
  const {
    aheadCount,
    counter,
    departmentName,
    doctorName,
    liveAppointment,
    servingToken,
    token,
    waitMinutes,
  } = getLiveQueueStatus({ appointment, appointments, doctor })
  const shareText = [
    `CareQueue token: ${token}`,
    `Doctor: ${doctorName}`,
    `Department: ${departmentName}`,
    `Counter: ${counter}`,
    `Slot: ${liveAppointment?.slot ?? 'Live queue'}`,
    `Patients ahead: ${aheadCount}`,
  ].join('\n')

  async function handleShare() {
    setShareStatus('')

    try {
      if (navigator.share) {
        await navigator.share({
          title: `CareQueue ${token}`,
          text: shareText,
        })
        setShareStatus(text.shareShared)
        return
      }

      await copyTextToClipboard(shareText)
      setShareStatus(text.shareCopied)
    } catch (shareError) {
      if (shareError.name !== 'AbortError') {
        setShareStatus(text.shareFailed)
      }
    }
  }

  return (
    <div className="token-page">
      <header className="department-hero token-hero">
        <div className="department-hero-bar">
          <div className="department-status">{time}</div>
          <button className="department-back-button" type="button" onClick={onBack} aria-label="Go back">
            ←
          </button>
        </div>
        <h1>{text.tokenIssued}</h1>
        <p>
          {departmentName} · {doctorName}
        </p>
      </header>

      <section className="token-content">
        <button
          className="token-number-card"
          type="button"
          onClick={onOpenQueue}
          aria-label={`${text.openLiveQueue}: ${token}`}
        >
          <p>{text.tokenNumber}</p>
          <strong>{token}</strong>
          <span>
            {departmentName} · {counter}
          </span>
        </button>

        <div className="token-summary">
          <div>
            <strong>{aheadCount}</strong>
            <span>{text.ahead}</span>
          </div>
          <div>
            <strong>~{waitMinutes}m</strong>
            <span>{text.wait}</span>
          </div>
          <div>
            <strong>{servingToken}</strong>
            <span>{text.serving}</span>
          </div>
        </div>

        <div className="token-details">
          <div>
            <span>{text.doctor}</span>
            <strong>{doctorName}</strong>
          </div>
          <div>
            <span>{text.department}</span>
            <strong>{departmentName}</strong>
          </div>
          <div>
            <span>{text.counter}</span>
            <strong>{counter}</strong>
          </div>
          <div>
            <span>{text.prescription}</span>
            <strong>{text.digitalCopySent}</strong>
          </div>
        </div>

        <div className="token-badges">
          <span>{text.smsAlerts}</span>
          <span>{text.qrCounter}</span>
          <span>{text.pharmacyLinked}</span>
        </div>

        <button className="token-share" data-state={shareStatus ? 'done' : 'idle'} type="button" onClick={handleShare}>
          {shareStatus || text.shareFamily}
        </button>
      </section>
    </div>
  )
}

function LiveQueuePage({ appointment, appointments = [], doctor, onBack, text, time }) {
  const {
    aheadCount,
    counter,
    doctorName,
    progressPercent,
    servingToken,
    token,
    waitMinutes,
  } = getLiveQueueStatus({ appointment, appointments, doctor })
  const queueTitle = [token, doctorName].filter(Boolean).join(' · ')
  const consultationMessage = text.consultationReady.replace('{counter}', counter)

  return (
    <div className="live-queue-page">
      <header className="live-queue-hero">
        <div className="department-hero-bar">
          <div className="department-status">{time}</div>
          <button className="department-back-button" type="button" onClick={onBack} aria-label="Go back">
            ←
          </button>
        </div>
        <h1>{text.liveQueue}</h1>
        <p>{queueTitle}</p>
      </header>

      <section className="live-queue-content">
        <div className="live-token-card">
          <p>{text.yourToken}</p>
          <strong>{token}</strong>
          <span>
            {aheadCount} {text.patientsAhead}
          </span>
        </div>

        <div className="live-queue-summary">
          <div>
            <strong>{aheadCount}</strong>
            <span>{text.ahead}</span>
          </div>
          <div>
            <strong>~{waitMinutes}m</strong>
            <span>{text.wait}</span>
          </div>
          <div>
            <strong>{servingToken}</strong>
            <span>{text.inConsult}</span>
          </div>
        </div>

        <div className="live-progress">
          <p>{text.queueProgress}</p>
          <div className="live-progress-track" aria-label={`${text.queueProgress}: ${progressPercent}%`}>
            <i style={{ width: `${progressPercent}%` }}></i>
          </div>
          <span>
            {servingToken} of {token}
          </span>
        </div>

        <div className="live-consult-card">
          <strong>{text.prepareConsultation}</strong>
          <p>{consultationMessage}</p>
        </div>

        <button className="live-delay-button" type="button" disabled>
          {text.delayTurn}
        </button>
      </section>
    </div>
  )
}

function RecordsPage({
  allAppointments = [],
  appointments = [],
  currentUser,
  doctors,
  onLogout,
  onOpenAppointment,
  text,
  time,
}) {
  const latestAppointment = appointments.find(isActiveAppointment) ?? appointments[0]
  const latestDoctor = doctors.find((doctor) => doctor.id === latestAppointment?.doctorId)
  const latestStatus = latestAppointment
    ? getLiveQueueStatus({ appointment: latestAppointment, appointments: allAppointments, doctor: latestDoctor })
    : null

  return (
    <div className="records-page">
      <header className="records-hero">
        <div className="department-hero-bar">
          <div className="department-status">{time}</div>
          <button className="records-logout-button" type="button" onClick={onLogout}>
            {text.logout}
          </button>
        </div>
        <h1>{text.records}</h1>
        <p>{currentUser?.name || formatMobileNumber(currentUser?.mobile)}</p>
      </header>

      <section className="records-content">
        <section className="records-panel" aria-label={text.notifications}>
          <div className="records-section-title">
            <h2>{text.notifications}</h2>
          </div>

          {latestStatus ? (
            <button
              className="records-notification"
              type="button"
              onClick={() => onOpenAppointment(latestAppointment, latestDoctor)}
            >
              <span>{text.latestUpdate}</span>
              <strong>{latestStatus.token}</strong>
              <em>
                {latestStatus.aheadCount} {text.patientsAhead} · ~{latestStatus.waitMinutes}m {text.wait}
              </em>
            </button>
          ) : (
            <p className="records-empty">{text.noNotifications}</p>
          )}
        </section>

        <section className="records-panel" aria-label={text.bookings}>
          <div className="records-section-title">
            <h2>{text.bookings}</h2>
          </div>

          {appointments.length === 0 ? (
            <p className="records-empty">{text.noBookings}</p>
          ) : (
            <div className="records-bookings-list">
              {appointments.map((appointment) => {
                const doctor = doctors.find((currentDoctor) => currentDoctor.id === appointment.doctorId)
                const status = String(appointment.status ?? 'waiting')

                return (
                  <button
                    className="records-booking-card"
                    key={appointment.id}
                    type="button"
                    onClick={() => onOpenAppointment(appointment, doctor)}
                  >
                    <span>
                      <strong>{appointment.token}</strong>
                      <em>{appointment.doctorName || doctor?.name || text.doctor}</em>
                    </span>
                    <span>
                      <small>
                        {text.bookedFor} {formatDateKeyTitle(appointment.dateKey)}
                      </small>
                      <small>{appointment.slot || appointment.department}</small>
                    </span>
                    <b>{status}</b>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </section>
    </div>
  )
}

function FooterNav({ activeTab, hasAppointment, onNavigate, text }) {
  const items = [
    { id: 'home', label: text.home, disabled: false },
    { id: 'token', label: 'Token', disabled: !hasAppointment },
    { id: 'appts', label: text.appts, disabled: false },
    { id: 'records', label: text.records, disabled: false },
  ]

  return (
    <nav className="carequeue-footer" aria-label="CareQueue navigation">
      {items.map((item) => (
        <button
          className="carequeue-footer-button"
          data-active={activeTab === item.id}
          disabled={item.disabled}
          key={item.id}
          type="button"
          onClick={() => onNavigate(item.id)}
        >
          <span className="carequeue-footer-icon" aria-hidden="true"></span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default FirstMobilePage

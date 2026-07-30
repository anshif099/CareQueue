export const DEFAULT_HOSPITAL_ID = 'default-primary'
export const TV_DOCTOR_ROTATION_MS = 15_000

export const DEFAULT_HOSPITAL = {
  id: DEFAULT_HOSPITAL_ID,
  name: 'City Health Clinic (Primary)',
  location: 'Main Headquarters',
  isPrimary: true,
}

function normalizeStatus(status) {
  return String(status ?? 'Consulting').trim().toLowerCase()
}

function parseTimeToMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time ?? '').trim())

  if (!match) {
    return null
  }

  const hour = Number(match[1])
  const minute = Number(match[2])

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }

  return hour * 60 + minute
}

function getDoctorScheduleRanges(doctor) {
  const schedules = [
    { startTime: doctor?.startTime, endTime: doctor?.endTime },
    ...(Array.isArray(doctor?.additionalSchedules) ? doctor.additionalSchedules : []),
  ]

  return schedules
    .map((schedule) => ({
      start: parseTimeToMinutes(schedule?.startTime),
      end: parseTimeToMinutes(schedule?.endTime),
    }))
    .filter((schedule) => schedule.start !== null && schedule.end !== null)
}

function isMinuteInRange(currentMinute, startMinute, endMinute) {
  if (startMinute === endMinute) {
    return true
  }

  if (endMinute > startMinute) {
    return currentMinute >= startMinute && currentMinute < endMinute
  }

  return currentMinute >= startMinute || currentMinute < endMinute
}

export function mapHospitals(hospitalsValue) {
  const storedHospitals = hospitalsValue
    ? Object.entries(hospitalsValue)
        .filter(([id]) => id !== DEFAULT_HOSPITAL_ID)
        .map(([id, hospital]) => ({ ...hospital, id }))
    : []

  return [DEFAULT_HOSPITAL, ...storedHospitals]
}

export function getDoctorHospitalId(doctor) {
  return String(doctor?.hospitalId || DEFAULT_HOSPITAL_ID)
}

export function isDoctorAvailableNow(doctor, currentDate = new Date()) {
  const availableStatuses = new Set(['consulting', 'available', 'open', 'serving'])

  if (!availableStatuses.has(normalizeStatus(doctor?.status))) {
    return false
  }

  const schedules = getDoctorScheduleRanges(doctor)

  // Keep legacy doctors with no configured schedule visible when their live status is available.
  if (schedules.length === 0) {
    return true
  }

  const currentMinute = currentDate.getHours() * 60 + currentDate.getMinutes()
  return schedules.some(({ start, end }) => isMinuteInRange(currentMinute, start, end))
}

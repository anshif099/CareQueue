import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_HOSPITAL,
  DEFAULT_HOSPITAL_ID,
  getDoctorHospitalId,
  isDoctorAvailableNow,
  mapHospitals,
  TV_DOCTOR_ROTATION_MS,
} from '../src/lib/tvDisplay.js'

function atTime(hour, minute = 0) {
  return new Date(2026, 6, 30, hour, minute, 0, 0)
}

test('TV doctor rotation interval is exactly 15 seconds', () => {
  assert.equal(TV_DOCTOR_ROTATION_MS, 15_000)
})

test('mapHospitals always supplies one default hospital and maps stored hospital IDs', () => {
  const hospitals = mapHospitals({
    [DEFAULT_HOSPITAL_ID]: {
      name: 'Stored duplicate should not replace the built-in default',
    },
    'hospital-west': {
      id: 'stale-embedded-id',
      name: 'Westside Hospital',
      location: 'West Wing',
    },
  })

  assert.equal(hospitals.length, 2)
  assert.deepEqual(hospitals[0], DEFAULT_HOSPITAL)
  assert.deepEqual(hospitals[1], {
    id: 'hospital-west',
    name: 'Westside Hospital',
    location: 'West Wing',
  })
})

test('mapHospitals handles an empty snapshot', () => {
  assert.deepEqual(mapHospitals(null), [DEFAULT_HOSPITAL])
})

test('legacy doctors without hospital ownership belong to the default hospital', () => {
  assert.equal(getDoctorHospitalId(undefined), DEFAULT_HOSPITAL_ID)
  assert.equal(getDoctorHospitalId({}), DEFAULT_HOSPITAL_ID)
  assert.equal(getDoctorHospitalId({ hospitalId: '' }), DEFAULT_HOSPITAL_ID)
  assert.equal(getDoctorHospitalId({ hospitalId: 'hospital-west' }), 'hospital-west')
})

test('availability accepts supported live statuses and rejects unavailable statuses', () => {
  for (const status of [undefined, 'Consulting', ' available ', 'OPEN', 'serving']) {
    assert.equal(
      isDoctorAvailableNow({ status }, atTime(12)),
      true,
      `expected status ${String(status)} to be available`,
    )
  }

  for (const status of ['On break', 'offline', 'unavailable', 'closed']) {
    assert.equal(
      isDoctorAvailableNow({ status }, atTime(12)),
      false,
      `expected status ${status} to be unavailable`,
    )
  }
})

test('an available legacy doctor with no valid schedule remains visible', () => {
  assert.equal(isDoctorAvailableNow({ status: 'Consulting' }, atTime(3, 15)), true)
  assert.equal(
    isDoctorAvailableNow(
      { status: 'Consulting', startTime: 'not-a-time', endTime: '17:00' },
      atTime(3, 15),
    ),
    true,
  )
})

test('normal schedules include the start minute and exclude the end minute', () => {
  const doctor = {
    status: 'Consulting',
    startTime: '09:00',
    endTime: '17:00',
  }

  assert.equal(isDoctorAvailableNow(doctor, atTime(8, 59)), false)
  assert.equal(isDoctorAvailableNow(doctor, atTime(9, 0)), true)
  assert.equal(isDoctorAvailableNow(doctor, atTime(16, 59)), true)
  assert.equal(isDoctorAvailableNow(doctor, atTime(17, 0)), false)
})

test('an additional schedule can make a doctor available outside the primary schedule', () => {
  const doctor = {
    status: 'Available',
    startTime: '09:00',
    endTime: '12:00',
    additionalSchedules: [
      {
        startTime: '18:00',
        endTime: '20:00',
      },
    ],
  }

  assert.equal(isDoctorAvailableNow(doctor, atTime(17, 59)), false)
  assert.equal(isDoctorAvailableNow(doctor, atTime(18, 0)), true)
  assert.equal(isDoctorAvailableNow(doctor, atTime(19, 59)), true)
  assert.equal(isDoctorAvailableNow(doctor, atTime(20, 0)), false)
})

test('overnight schedules remain available across midnight', () => {
  const doctor = {
    status: 'Serving',
    startTime: '22:00',
    endTime: '02:00',
  }

  assert.equal(isDoctorAvailableNow(doctor, atTime(21, 59)), false)
  assert.equal(isDoctorAvailableNow(doctor, atTime(22, 0)), true)
  assert.equal(isDoctorAvailableNow(doctor, atTime(23, 59)), true)
  assert.equal(isDoctorAvailableNow(doctor, atTime(0, 0)), true)
  assert.equal(isDoctorAvailableNow(doctor, atTime(1, 59)), true)
  assert.equal(isDoctorAvailableNow(doctor, atTime(2, 0)), false)
})

test('equal schedule start and end represents 24-hour availability', () => {
  const doctor = {
    status: 'Open',
    startTime: '00:00',
    endTime: '00:00',
  }

  assert.equal(isDoctorAvailableNow(doctor, atTime(0, 0)), true)
  assert.equal(isDoctorAvailableNow(doctor, atTime(12, 30)), true)
  assert.equal(isDoctorAvailableNow(doctor, atTime(23, 59)), true)
})

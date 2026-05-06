import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyCYuLucyUDI8cViMYW6nt9dEUpJktyOrd4',
  authDomain: 'carequeue-7aab6.firebaseapp.com',
  databaseURL: 'https://carequeue-7aab6-default-rtdb.firebaseio.com',
  projectId: 'carequeue-7aab6',
  storageBucket: 'carequeue-7aab6.firebasestorage.app',
  messagingSenderId: '1083516399599',
  appId: '1:1083516399599:web:cf50bf58995795ebc5501a',
  measurementId: 'G-L6M1FDNJC4',
}

const app = initializeApp(firebaseConfig)
const database = getDatabase(app)
const analyticsPromise = isSupported()
  .then((supported) => (supported ? getAnalytics(app) : null))
  .catch(() => null)

export { analyticsPromise, app, database }

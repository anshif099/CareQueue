import HomePage from './pages/HomePage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import DoctorPage from './pages/DoctorPage.jsx'

function App() {
  const route = window.location.pathname.replace(/\/+$/, '')

  if (route === '/admin') {
    return <AdminPage />
  }

  if (route === '/doctor') {
    return <DoctorPage />
  }

  return <HomePage />
}

export default App

import HomePage from './pages/HomePage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import DoctorPage from './pages/DoctorPage.jsx'
import TvPage from './pages/TvPage.jsx'
import LabPage from './pages/LabPage.jsx'

function App() {
  const route = window.location.pathname.replace(/\/+$/, '')

  if (route === '/admin') {
    return <AdminPage />
  }

  if (route === '/doctor') {
    return <DoctorPage />
  }

  if (route === '/tv') {
    return <TvPage />
  }

  if (route === '/lab') {
    return <LabPage />
  }

  return <HomePage />
}

export default App

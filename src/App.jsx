import HomePage from './pages/HomePage.jsx'
import AdminPage from './pages/AdminPage.jsx'

function App() {
  if (window.location.pathname.replace(/\/+$/, '') === '/admin') {
    return <AdminPage />
  }

  return <HomePage />
}

export default App

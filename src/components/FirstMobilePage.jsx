import { useEffect, useMemo, useState } from 'react'
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
    helper: 'Scan QR from reception or enter OPD number',
  },
  hi: {
    clinic: 'सिटी हेल्थ क्लिनिक',
    selectLanguage: 'भाषा चुनें',
    helper: 'रिसेप्शन से QR स्कैन करें या OPD नंबर दर्ज करें',
  },
  ml: {
    clinic: 'സിറ്റി ഹെൽത്ത് ക്ലിനിക്',
    selectLanguage: 'ഭാഷ തിരഞ്ഞെടുക്കുക',
    helper: 'റിസപ്ഷനിൽ നിന്ന് QR സ്കാൻ ചെയ്യുക അല്ലെങ്കിൽ OPD നമ്പർ നൽകുക',
  },
  ta: {
    clinic: 'சிட்டி ஹெல்த் கிளினிக்',
    selectLanguage: 'மொழியைத் தேர்ந்தெடுக்கவும்',
    helper: 'ரிசப்ஷனில் இருந்து QR ஸ்கேன் செய்யவும் அல்லது OPD எண்ணை உள்ளிடவும்',
  },
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
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date())
}

function FirstMobilePage() {
  const [selectedLanguage, setSelectedLanguage] = useState(getInitialLanguage)
  const [time, setTime] = useState(getDeviceTime)

  const activeLanguage = useMemo(
    () => languages.find((language) => language.id === selectedLanguage) ?? languages[0],
    [selectedLanguage],
  )

  const text = translations[selectedLanguage] ?? translations.en

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTime(getDeviceTime())
    }, 15000)

    return () => window.clearInterval(timer)
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
      <section className="carequeue-phone">
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
        </div>

        <p className="carequeue-helper">{text.helper}</p>
      </section>
    </main>
  )
}

export default FirstMobilePage

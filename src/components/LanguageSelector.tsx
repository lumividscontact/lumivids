import { useState, useRef, useEffect } from 'react'
import { Globe, ChevronDown } from 'lucide-react'
import { useLanguage, Language } from '@/i18n'

export default function LanguageSelector() {
  const { language, setLanguage, languages } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentLang = languages.find((l) => l.code === language)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (code: Language) => {
    setLanguage(code)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-dark-800/50 border border-dark-700 
                   hover:border-dark-600 hover:bg-dark-800 transition-all duration-200"
      >
        <Globe className="w-4 h-4 text-dark-400" />
        <span className="text-lg">{currentLang?.flag}</span>
        <span className="text-sm text-dark-300 hidden sm:inline">{currentLang?.code.toUpperCase()}</span>
        <ChevronDown className={`w-4 h-4 text-dark-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 py-2 rounded-xl bg-dark-800 border border-dark-700 
                        shadow-xl shadow-black/20 z-50 overflow-hidden">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                         ${language === lang.code 
                           ? 'bg-primary-500/20 text-primary-400' 
                           : 'text-dark-300 hover:bg-dark-700/50 hover:text-white'
                         }`}
            >
              <span className="text-xl">{lang.flag}</span>
              <span className="font-medium">{lang.name}</span>
              {language === lang.code && (
                <span className="ml-auto text-primary-400">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

import {
  ArrowRight,
  ChevronDown,
  Clock,
  Image,
  ImagePlus,
  Layers,
  Play,
  Shield,
  Sparkles,
  Star,
  Video,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import BrandLogo from '@/components/BrandLogo'

type LandingTranslations = Record<string, any>

interface TestimonialItem {
  name: string
  role: string
  content: string
}

interface FaqItem {
  key: string
}

interface LandingDeferredSectionsProps {
  t: LandingTranslations
  testimonials: TestimonialItem[]
  faqs: FaqItem[]
  openFaq: number | null
  onToggleFaq: (next: number | null) => void
}

const features = [
  {
    icon: Video,
    gradient: 'from-blue-500 to-cyan-500',
    key: 'textToVideo',
  },
  {
    icon: Layers,
    gradient: 'from-purple-500 to-pink-500',
    key: 'imageToVideo',
  },
  {
    icon: ImagePlus,
    gradient: 'from-orange-500 to-red-500',
    key: 'textToImage',
  },
  {
    icon: Image,
    gradient: 'from-green-500 to-emerald-500',
    key: 'imageToImage',
  },
]

const aiModels = [
  { name: 'Kling 2.1', icon: '🚀', gradient: 'from-purple-600 to-blue-600' },
  { name: 'Kling 2.5 Turbo', icon: '⚡', gradient: 'from-blue-500 to-cyan-500' },
  { name: 'Hailuo 2.3', icon: '🎬', gradient: 'from-gray-600 to-gray-800' },
  { name: 'Luma Ray 2', icon: '✨', gradient: 'from-pink-500 to-purple-500' },
  { name: 'Wan 2.6', icon: '🌊', gradient: 'from-cyan-500 to-blue-500' },
  { name: 'SeeDance', icon: '🏃', gradient: 'from-orange-500 to-red-500' },
  { name: 'Sora 2', icon: '🎥', gradient: 'from-green-600 to-emerald-600' },
  { name: 'Veo 3.1', icon: '⭐', gradient: 'from-yellow-500 to-orange-500' },
  { name: 'Nano Banana', icon: '🍌', gradient: 'from-yellow-400 to-yellow-600' },
  { name: 'Flux', icon: '🔥', gradient: 'from-red-500 to-orange-500' },
  { name: 'Stable Diffusion', icon: '🎨', gradient: 'from-violet-500 to-purple-600' },
  { name: 'Ideogram', icon: '💡', gradient: 'from-blue-400 to-indigo-500' },
  { name: 'PrunaAI', icon: '🧠', gradient: 'from-pink-400 to-rose-500' },
  { name: 'DALL-E', icon: '🖼️', gradient: 'from-teal-500 to-green-500' },
  { name: 'Qwen', icon: '🤖', gradient: 'from-slate-500 to-gray-700' },
  { name: 'Seedream', icon: '🌱', gradient: 'from-emerald-400 to-green-600' },
]

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export default function LandingDeferredSections({
  t,
  testimonials,
  faqs,
  openFaq,
  onToggleFaq,
}: LandingDeferredSectionsProps) {
  return (
    <>
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">{t.home.features.title}</h2>
            <p className="text-xl text-dark-400 max-w-2xl mx-auto">
              {t.landing.features.subtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => {
              const featureT = t.home.features[feature.key as keyof typeof t.home.features] as {
                title: string
                description: string
              }
              return (
                <div key={feature.key} className="card-hover group">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">{featureT.title}</h3>
                  <p className="text-dark-400">{featureT.description}</p>
                </div>
              )
            })}
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="card flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {t.landing.additionalFeatures.fast.title}
                </h3>
                <p className="text-dark-400 text-sm">
                  {t.landing.additionalFeatures.fast.description}
                </p>
              </div>
            </div>
            <div className="card flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {t.landing.additionalFeatures.secure.title}
                </h3>
                <p className="text-dark-400 text-sm">
                  {t.landing.additionalFeatures.secure.description}
                </p>
              </div>
            </div>
            <div className="card flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {t.landing.additionalFeatures.available.title}
                </h3>
                <p className="text-dark-400 text-sm">
                  {t.landing.additionalFeatures.available.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="models" className="py-16 px-4 bg-dark-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {t.landing.models.title}
            </h2>
            <p className="text-xl text-dark-400 max-w-2xl mx-auto">
              {t.landing.models.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 md:gap-3 max-w-5xl mx-auto">
            {aiModels.map((model) => (
              <div key={model.name} className="flex flex-col items-center gap-1">
                <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br ${model.gradient} flex items-center justify-center shadow-lg border border-white/10`}>
                  <span className="text-xl md:text-2xl">{model.icon}</span>
                </div>
                <span className="text-xs text-dark-300 font-medium text-center">{model.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">{t.landing.howItWorks.title}</h2>
            <p className="text-xl text-dark-400 max-w-2xl mx-auto">{t.landing.howItWorks.subtitle}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg border-4 border-dark-950 z-10">1</div>
              <div className="card overflow-hidden">
                <div className="h-32 bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-3xl">💬</span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-2">{t.landing.howItWorks.step1.title}</h3>
                  <p className="text-dark-400 text-sm">{t.landing.howItWorks.step1.description}</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold text-xl shadow-lg border-4 border-dark-950 z-10">2</div>
              <div className="card overflow-hidden">
                <div className="h-32 bg-gradient-to-br from-purple-500/20 to-pink-600/20 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                    <span className="text-3xl">✨</span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-2">{t.landing.howItWorks.step2.title}</h3>
                  <p className="text-dark-400 text-sm">{t.landing.howItWorks.step2.description}</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-red-600 flex items-center justify-center text-white font-bold text-xl shadow-lg border-4 border-dark-950 z-10">3</div>
              <div className="card overflow-hidden">
                <div className="h-32 bg-gradient-to-br from-pink-500/20 to-red-600/20 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-red-600 flex items-center justify-center">
                    <span className="text-3xl">🎬</span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-2">{t.landing.howItWorks.step3.title}</h3>
                  <p className="text-dark-400 text-sm">{t.landing.howItWorks.step3.description}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="testimonials" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {t.landing.testimonials.title}
            </h2>
            <p className="text-xl text-dark-400 max-w-2xl mx-auto">
              {t.landing.testimonials.subtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial) => (
              <div key={testimonial.name} className="card">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-dark-300 mb-6">"{testimonial.content}"</p>
                <div className="flex items-center gap-3">
                  <div
                    aria-label={testimonial.name}
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-white font-semibold text-sm flex items-center justify-center"
                  >
                    {getInitials(testimonial.name)}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{testimonial.name}</div>
                    <div className="text-dark-400 text-sm">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="py-24 px-4 bg-dark-900/50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">{t.pricing.faq.title}</h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const faqT = t.pricing.faq[faq.key as keyof typeof t.pricing.faq] as {
                question: string
                answer: string
              }
              return (
                <div key={faq.key} className="card">
                  <button
                    onClick={() => onToggleFaq(openFaq === index ? null : index)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <span className="text-lg font-semibold text-white">{faqT.question}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-dark-400 transition-transform ${
                        openFaq === index ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openFaq === index && (
                    <p className="text-dark-400 mt-4 pt-4 border-t border-dark-700">{faqT.answer}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 to-accent-500/20" />
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-primary-500/10 rounded-full blur-3xl" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">{t.home.cta.title}</h2>
          <p className="text-xl text-dark-300 mb-8">{t.home.cta.subtitle}</p>
          <Link to="/text-to-video" className="btn-primary text-lg px-10 py-4 inline-flex items-center gap-2">
            {t.home.cta.button}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <footer className="py-12 px-4 border-t border-dark-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-5 gap-8 mb-12">
            <div className="md:col-span-2">
              <Link to="/" className="flex items-center gap-2 mb-4">
                <BrandLogo />
              </Link>
              <p className="text-dark-400 max-w-md">
                {t.landing.footer.description}
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">{t.landing.footer.product}</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#features" className="text-dark-400 hover:text-white transition-colors">
                    {t.landing.nav.features}
                  </a>
                </li>
                <li>
                  <Link to="/plans" className="text-dark-400 hover:text-white transition-colors">
                    {t.nav.pricing}
                  </Link>
                </li>
                <li>
                  <a href="#models" className="text-dark-400 hover:text-white transition-colors">
                    {t.landing.nav.models}
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">{t.landing.footer.legal}</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/privacy" className="text-dark-400 hover:text-white transition-colors">
                    {t.auth.privacy}
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-dark-400 hover:text-white transition-colors">
                    {t.auth.terms}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">{t.landing.footer.partners}</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://z-image.net/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-dark-400 hover:text-white transition-colors"
                  >
                    Z-Image
                  </a>
                </li>
                <li>
                  <a
                    href="https://twelve.tools/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-dark-400 hover:text-white transition-colors"
                  >
                    Twelve Tools
                  </a>
                </li>
                <li>
                  <a
                    href="https://ypforai.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-dark-400 hover:text-white transition-colors"
                  >
                    YP for AI
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-dark-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-dark-400 text-sm">
              © {new Date().getFullYear()} Lumivids. {t.landing.footer.rights}
            </p>
            <div className="flex items-center gap-6">
              <a
                href="https://x.com/lumivids"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dark-400 hover:text-white transition-colors"
              >
                Twitter
              </a>
              <a
                href="https://instagram.com/lumivids"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dark-400 hover:text-white transition-colors"
              >
                Instagram
              </a>
              <a
                href="https://youtube.com/@lumivids"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dark-400 hover:text-white transition-colors"
              >
                YouTube
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}

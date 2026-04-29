import type { ReactNode } from 'react'
import { BadgeCheck, Fingerprint, KeyRound, Landmark, ShieldCheck, Smartphone } from 'lucide-react'

type PublicServicesAuthShellProps = {
  mode: 'login' | 'register'
  title: string
  subtitle: string
  stageLabel: string
  steps: string[]
  activeStep: number
  wide?: boolean
  children: ReactNode
}

const capabilityItems = [
  { icon: Fingerprint, label: 'Biometrik identifikatsiya' },
  { icon: Smartphone, label: 'Telegram OTP tasdiqlash' },
  { icon: KeyRound, label: 'Parol orqali autentifikatsiya' },
  { icon: ShieldCheck, label: 'Ko‘p bosqichli himoya' },
]

export function PublicServicesAuthShell({
  mode,
  title,
  subtitle,
  stageLabel,
  steps,
  activeStep,
  wide = false,
  children,
}: PublicServicesAuthShellProps) {
  return (
    <main className="min-h-screen bg-[#eef3f8] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-stretch px-0 py-0 sm:items-center sm:px-4 sm:py-4 lg:px-8 lg:py-6">
        <div
          className={`grid w-full min-w-0 overflow-hidden border border-slate-200 bg-white shadow-xl sm:rounded-lg ${
            wide ? 'lg:grid-cols-[0.9fr_1.1fr]' : 'lg:grid-cols-[0.95fr_1fr]'
          }`}
        >
          <aside className="min-w-0 bg-[#0d3b66] p-5 text-white sm:p-7 lg:p-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-white text-[#0d3b66] sm:h-12 sm:w-12">
                <Landmark className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#b7d7f2] sm:text-sm sm:tracking-[0.18em]">
                  Davlat xizmatlari
                </p>
                <p className="text-sm text-white/80">Yagona autentifikatsiya oynasi</p>
              </div>
            </div>

            <div className="mt-7 space-y-4 sm:mt-9 lg:mt-10">
              <div className="inline-flex max-w-full items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[#d8b24c] sm:tracking-[0.16em]">
                <BadgeCheck className="h-4 w-4" />
                Diplom loyihasi
              </div>
              <h1 className="max-w-2xl text-xl font-semibold leading-tight sm:text-3xl lg:text-4xl">
                Davlat xizmatlari portalida foydalanuvchilarni identifikatsiyalash va autentifikatsiyalashning zamonaviy usullari
              </h1>
              <p className="max-w-xl text-sm leading-6 text-[#d7e6f5]">
                Foydalanuvchi hisobini parol, bir martalik kod, QR sessiya va yuzni tasdiqlash orqali himoyalangan oqimda boshqarish.
              </p>
            </div>

            <div className="mt-6 grid gap-2 sm:mt-8 sm:grid-cols-2 sm:gap-3">
              {capabilityItems.map(({ icon: Icon, label }) => (
                <div key={label} className="rounded-md border border-white/15 bg-white/10 p-3">
                  <Icon className="h-5 w-5 text-[#8bd3b7]" />
                  <p className="mt-2 text-xs leading-5 text-white/90 sm:text-sm">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-md bg-white p-1 text-sm font-medium text-slate-700">
              <div className="grid grid-cols-2 gap-1">
                <a
                  href="/auth/login"
                  className={`rounded px-3 py-2 text-center transition ${
                    mode === 'login' ? 'bg-[#0d3b66] text-white' : 'hover:bg-slate-100'
                  }`}
                >
                  Kirish
                </a>
                <a
                  href="/auth/register"
                  className={`rounded px-3 py-2 text-center transition ${
                    mode === 'register' ? 'bg-[#0d3b66] text-white' : 'hover:bg-slate-100'
                  }`}
                >
                  Ro‘yxatdan o‘tish
                </a>
              </div>
            </div>
          </aside>

          <section className="min-w-0 p-5 sm:p-8 lg:p-10">
            <div className="mb-6">
              <p id="auth-shell-stage" className="text-sm font-medium text-[#0d6b5f]">{stageLabel}</p>
              <h2 id="auth-shell-title" className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">{title}</h2>
              <p id="auth-shell-subtitle" className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>
            </div>

            <div id="auth-shell-steps" className="mb-8 grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
              {steps.map((step, index) => (
                <div key={step} className="space-y-2" data-auth-step={index}>
                  <div
                    data-auth-step-bar
                    className={`h-2 rounded-full transition ${
                      index < activeStep
                        ? 'bg-[#0d6b5f]'
                        : index === activeStep
                          ? 'bg-[#0d3b66]'
                          : 'bg-slate-200'
                    }`}
                  />
                  <p data-auth-step-label className={`text-xs ${index === activeStep ? 'font-semibold text-[#0d3b66]' : 'text-slate-500'}`}>
                    {step}
                  </p>
                </div>
              ))}
            </div>

            {children}
          </section>
        </div>
      </div>
    </main>
  )
}

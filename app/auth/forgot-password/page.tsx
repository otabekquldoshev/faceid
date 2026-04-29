'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, ShieldCheck } from 'lucide-react'

type ResetStage = 'request' | 'reset'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [stage, setStage] = useState<ResetStage>('request')
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [userId, setUserId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRequestSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!identifier) {
      setError('Iltimos, foydalanuvchi nomi yoki emailni kiriting.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'request', identifier }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Xatolik yuz berdi. Iltimos qayta urinib ko‘ring.')
        return
      }

      setUserId(data.userId)
      setStage('reset')
      setSuccess(data.devOtp ? `Development OTP: ${data.devOtp}` : 'Telegramga yuborilgan OTP kodini kiriting.')
    } catch {
      setError('Tarmoqli xato. Iltimos, qayta urinib ko‘ring.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!otp || !newPassword || !confirmPassword) {
      setError('Iltimos, barcha maydonlarni to‘ldiring.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Parollar mos emas.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'reset', userId, otp, newPassword }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Parolni tiklashda xatolik yuz berdi.')
        return
      }

      setSuccess('Parolingiz muvaffaqiyatli yangilandi. Endi tizimga kiring.')
      setTimeout(() => router.push('/auth/login'), 1400)
    } catch {
      setError('Tarmoqli xato. Iltimos, qayta urinib ko‘ring.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background grid-bg flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 blur-3xl" />
      <Card className="relative w-full max-w-2xl overflow-hidden border-primary/30 neon-pulse">
        <div className="grid md:grid-cols-[1.15fr_0.85fr] gap-6">
          <div className="p-10 bg-slate-950 text-white">
            <div className="flex items-center gap-2 mb-6 text-sm uppercase tracking-[0.3em] text-primary">
              <ShieldCheck className="w-5 h-5" />
              recover access
            </div>
            <h1 className="text-4xl font-bold leading-tight">Parolni tiklash</h1>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Parolingizni unutdingizmi? Telegram orqali yuborilgan bir martalik kod yordamida yangi parol o‘rnating.
            </p>
            <div className="mt-8 space-y-4 text-sm text-slate-300">
              <p>• Login yoki email orqali hisobingiz aniqlanadi.</p>
              <p>• Accountga bog‘langan Telegramga yuborilgan 6 xonali kodni kiriting.</p>
              <p>• Yangi parol o‘rnating va tizimga qayting.</p>
            </div>
            <div className="mt-10 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Avvalgi sahifalar</p>
              <p className="mt-2 text-sm text-slate-200">Agar yangi foydalanuvchi bo‘lsangiz, ro‘yxatdan o‘ting.</p>
              <div className="mt-4 flex flex-col gap-3">
                <Button variant="secondary" onClick={() => router.push('/auth/register')} className="w-full">
                  Ro‘yxatdan o‘tish
                </Button>
                <Button variant="secondary" onClick={() => router.push('/auth/login')} className="w-full">
                  Tizimga kirish
                </Button>
              </div>
            </div>
          </div>

          <div className="p-10 bg-card">
            <div className="mb-8 text-center">
              <p className="text-sm text-muted-foreground">Parolni unutdingizmi</p>
              <h2 className="mt-2 text-3xl font-semibold text-foreground">Xavfsiz tiklash</h2>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700">
                {success}
              </div>
            )}

            {stage === 'request' ? (
              <form onSubmit={handleRequestSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Foydalanuvchi nomi yoki email</label>
                  <Input
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="username yoki email"
                    autoComplete="username"
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground neon-pulse">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Kod yuborilmoqda...
                    </>
                  ) : (
                    'OTP kodini yuborish'
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Telegramdan olingan OTP</label>
                  <Input
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    placeholder="000000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Yangi parol</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Yangi parol"
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Parolni tasdiqlang</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Yangi parolni qayta kiriting"
                    autoComplete="new-password"
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground neon-pulse">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Tiklanmoqda...
                    </>
                  ) : (
                    'Parolni tiklash'
                  )}
                </Button>
              </form>
            )}

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <Link href="/auth/login" className="font-medium text-primary hover:underline">
                Tizimga qaytish
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

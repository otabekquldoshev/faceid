import { PublicServicesAuthShell } from '@/components/auth/public-services-auth-shell'
import { NativeAuthMount } from '@/components/auth/native-auth-mount'

export default function RegisterPage() {
  return (
    <PublicServicesAuthShell
      mode="register"
      title="Ro‘yxatdan o‘tish"
      subtitle="Hisob ma’lumotlari, Telegram OTP manzili va parolni kiriting."
      stageLabel="1-bosqich / 2"
      steps={['Hisob ma’lumotlari', 'Face ID']}
      activeStep={0}
      wide
    >
      <NativeAuthMount mode="register" />
    </PublicServicesAuthShell>
  )
}

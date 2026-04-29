import { PublicServicesAuthShell } from '@/components/auth/public-services-auth-shell'
import { NativeAuthMount } from '@/components/auth/native-auth-mount'

export default function LoginPage() {
  return (
    <PublicServicesAuthShell
      mode="login"
      title="Tizimga kirish"
      subtitle="Davlat xizmatlari portaliga kirish uchun login yoki emailni kiriting."
      stageLabel="1-bosqich / 4"
      steps={['Identifikator', 'Parol', 'OTP', 'Face ID']}
      activeStep={0}
      wide
    >
      <NativeAuthMount mode="login" />
    </PublicServicesAuthShell>
  )
}

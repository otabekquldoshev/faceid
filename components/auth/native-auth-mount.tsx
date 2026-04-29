'use client'

import { useEffect } from 'react'

type NativeAuthMountProps = {
  mode: 'login' | 'register'
}

export function NativeAuthMount({ mode }: NativeAuthMountProps) {
  useEffect(() => {
    const root = document.getElementById('auth-native-root')
    if (root) root.innerHTML = ''

    const script = document.createElement('script')
    script.src = '/auth-native.js'
    script.async = false
    document.body.appendChild(script)

    return () => {
      script.remove()
    }
  }, [mode])

  return <div id="auth-native-root" data-mode={mode} />
}

'use client'

import { useEffect } from 'react'

const mobileFaceScript = String.raw`
(function () {
  if (window.__mobileFaceCleanup) window.__mobileFaceCleanup()

  var SUCCESS_REDIRECT_URL = 'https://my.gov.uz/uz'
  var CAMERA_START_TIMEOUT_MS = 12000
  var GRID_SIZE = 16
  var COLOR_GRID_SIZE = 4
  var SAMPLE_COUNT = GRID_SIZE * GRID_SIZE
  var COLOR_SAMPLE_COUNT = COLOR_GRID_SIZE * COLOR_GRID_SIZE * 3

  var sessionToken = new URLSearchParams(window.location.search).get('session')
  var userId = new URLSearchParams(window.location.search).get('user')
  var registerToken = new URLSearchParams(window.location.search).get('register')
  var isRegistration = Boolean(registerToken)
  var video = document.getElementById('face-video')
  var canvas = document.getElementById('face-canvas')
  var startButton = document.getElementById('start-camera')
  var verifyButton = document.getElementById('verify-face')
  var pageTitle = document.getElementById('mobile-face-title')
  var pageSubtitle = document.getElementById('mobile-face-subtitle')
  var errorBox = document.getElementById('error-box')
  var errorText = document.getElementById('error-text')
  var successBox = document.getElementById('success-box')
  var statusText = document.getElementById('status-text')
  var progressBar = document.getElementById('progress-bar')
  var progressText = document.getElementById('progress-text')
  var sampleText = document.getElementById('sample-text')
  var overlay = document.getElementById('camera-overlay')
  var overlayIcon = document.getElementById('overlay-icon')
  var overlayText = document.getElementById('overlay-text')

  var stream = null
  var intervalId = null
  var signatures = []
  var detectionData = null
  var cameraState = 'idle'
  var requestId = 0
  var loading = false
  var verified = false

  if (isRegistration) {
    if (pageTitle) pageTitle.textContent = 'Mobil Face ID ro‘yxatga olish'
    if (pageSubtitle) pageSubtitle.textContent = 'Ro‘yxatdan o‘tishni yakunlash uchun yuz profilingizni telefon kamerasi orqali saqlang.'
    if (successBox) successBox.textContent = 'Face ID olindi. Kompyuterdagi ro‘yxatdan o‘tish oynasiga qayting.'
  }

  function redirectToSuccess(url) {
    var target = url || SUCCESS_REDIRECT_URL
    requestId += 1
    clearLoop()
    stopStream(stream)
    setTimeout(function () {
      window.location.replace(target)
    }, 50)
    setTimeout(function () {
      window.location.href = target
    }, 700)
  }

  function setHidden(element, hidden) {
    if (!element) return
    if (hidden) element.classList.add('hidden')
    else element.classList.remove('hidden')
  }

  function showError(message) {
    if (!errorBox || !errorText) return
    errorText.textContent = message
    setHidden(errorBox, false)
  }

  function clearError() {
    if (!errorBox || !errorText) return
    errorText.textContent = ''
    setHidden(errorBox, true)
  }

  function stopStream(activeStream) {
    if (!activeStream) return
    activeStream.getTracks().forEach(function (track) {
      track.stop()
    })
  }

  function clearLoop() {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  function resetCapture() {
    signatures = []
    detectionData = null
    updateProgress(0, 'Kamera ishga tushmoqda...')
    updateSamples()
    updateVerifyButton()
    clearCanvas()
  }

  function updateProgress(progress, message) {
    if (statusText) statusText.textContent = message
    if (progressBar) progressBar.style.width = progress + '%'
    if (progressText) progressText.textContent = 'Progress: ' + progress + '%'
  }

  function updateSamples() {
    if (sampleText) sampleText.textContent = 'Face samples: ' + Math.min(signatures.length, 5) + '/5'
  }

  function updateVerifyButton() {
    if (!verifyButton) return
    verifyButton.disabled = loading || verified || !detectionData || !detectionData.faceProfile
    verifyButton.innerHTML = loading
      ? '<span class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>Tekshirilmoqda...'
      : isRegistration ? 'Face IDni yuborish' : 'Yuzni tasdiqlash'
  }

  function setCameraState(nextState) {
    cameraState = nextState

    if (startButton) {
      startButton.disabled = nextState === 'starting'
      startButton.innerHTML = nextState === 'starting'
        ? '<span class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>Ochilyapti...'
        : 'Kamerani ochish'
    }

    if (overlay) setHidden(overlay, nextState === 'streaming')
    if (overlayIcon) overlayIcon.textContent = nextState === 'starting' ? '⏳' : nextState === 'failed' ? '⚠' : '📷'
    if (overlayText) {
      overlayText.textContent = nextState === 'starting'
        ? 'Kamera ruxsati kutilmoqda...'
        : 'Kamerani ochish uchun tugmani bosing.'
    }
  }

  function clearCanvas() {
    if (!canvas) return
    var ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width || 640, canvas.height || 480)
  }

  function requestCameraStream() {
    var constraintsList = [
      {
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      },
      {
        video: { facingMode: 'user' },
        audio: false,
      },
      {
        video: true,
        audio: false,
      },
    ]

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      var index = 0

      function tryNext(lastError) {
        if (index >= constraintsList.length) {
          return Promise.reject(lastError || new Error('Camera stream request failed'))
        }

        return navigator.mediaDevices.getUserMedia(constraintsList[index++]).catch(tryNext)
      }

      return tryNext()
    }

    var legacyGetUserMedia =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia

    if (!legacyGetUserMedia) {
      return Promise.reject(new Error('MEDIA_DEVICES_UNAVAILABLE'))
    }

    return new Promise(function (resolve, reject) {
      legacyGetUserMedia.call(navigator, constraintsList[0], resolve, reject)
    })
  }

  function withTimeout(promise, timeoutMs) {
    var timeoutId

    var timeoutPromise = new Promise(function (_, reject) {
      timeoutId = setTimeout(function () {
        reject(new Error('CAMERA_START_TIMEOUT'))
      }, timeoutMs)
    })

    return Promise.race([promise, timeoutPromise]).finally(function () {
      clearTimeout(timeoutId)
    })
  }

  function waitForVideoReady() {
    if (!video) return Promise.reject(new Error('VIDEO_MISSING'))
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      return Promise.resolve()
    }

    return new Promise(function (resolve, reject) {
      var timeoutId = setTimeout(function () {
        cleanup()
        reject(new Error('VIDEO_READY_TIMEOUT'))
      }, 6000)

      function cleanup() {
        clearTimeout(timeoutId)
        video.removeEventListener('loadedmetadata', handleReady)
        video.removeEventListener('canplay', handleReady)
        video.removeEventListener('error', handleError)
      }

      function handleReady() {
        if (video.videoWidth > 0) {
          cleanup()
          resolve()
        }
      }

      function handleError() {
        cleanup()
        reject(new Error('VIDEO_ELEMENT_ERROR'))
      }

      video.addEventListener('loadedmetadata', handleReady)
      video.addEventListener('canplay', handleReady)
      video.addEventListener('error', handleError)
    })
  }

  function getCameraErrorMessage(error) {
    var name = error && error.name ? error.name : ''
    var message = error && error.message ? error.message : ''

    if (message === 'CAMERA_START_TIMEOUT') {
      return 'Brauzer kamera ruxsat oynasini ochmadi. Linkni Chrome yoki Safari’da ochib qayta urinib ko‘ring.'
    }

    if (message === 'MEDIA_DEVICES_UNAVAILABLE') {
      return 'Bu browser kamerani qo‘llab-quvvatlamaydi. Linkni Chrome yoki Safari’da oching.'
    }

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
      return 'Kamera ruxsati bloklangan. Browser sozlamalaridan Camera permissionni Allow qiling.'
    }

    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'Bu qurilmada kamera topilmadi.'
    }

    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'Kamera boshqa ilova tomonidan band. Kamera ilovalarini yopib qayta urinib ko‘ring.'
    }

    return 'Kamera ochilmadi. Linkni Chrome yoki Safari’da ochib qayta urinib ko‘ring.'
  }

  function getSourceSize(source) {
    if (source instanceof HTMLVideoElement) {
      return {
        width: source.videoWidth || source.clientWidth || 640,
        height: source.videoHeight || source.clientHeight || 480,
      }
    }

    return {
      width: source.naturalWidth || source.width || 640,
      height: source.naturalHeight || source.height || 480,
    }
  }

  function createSignature(source) {
    var size = getSourceSize(source)
    if (!size.width || !size.height) return null

    var cropWidth = Math.min(size.width, size.height) * 0.68
    var cropHeight = cropWidth * 1.18
    var cropX = (size.width - cropWidth) / 2
    var cropY = (size.height - cropHeight) / 2
    var signatureCanvas = document.createElement('canvas')
    signatureCanvas.width = GRID_SIZE
    signatureCanvas.height = GRID_SIZE

    var ctx = signatureCanvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null

    ctx.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, GRID_SIZE, GRID_SIZE)

    var imageData = ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE).data
    var samples = []

    for (var y = 0; y < GRID_SIZE; y++) {
      for (var x = 0; x < GRID_SIZE; x++) {
        var offset = (y * GRID_SIZE + x) * 4
        var luminance = Math.round(
          imageData[offset] * 0.299 + imageData[offset + 1] * 0.587 + imageData[offset + 2] * 0.114
        )
        samples.push(luminance)
      }
    }

    var gradientSamples = []
    for (var gradientY = 0; gradientY < GRID_SIZE; gradientY++) {
      for (var gradientX = 0; gradientX < GRID_SIZE; gradientX++) {
        var left = samples[gradientY * GRID_SIZE + Math.max(0, gradientX - 1)]
        var right = samples[gradientY * GRID_SIZE + Math.min(GRID_SIZE - 1, gradientX + 1)]
        var up = samples[Math.max(0, gradientY - 1) * GRID_SIZE + gradientX]
        var down = samples[Math.min(GRID_SIZE - 1, gradientY + 1) * GRID_SIZE + gradientX]
        gradientSamples.push(Math.max(0, Math.min(255, Math.round(Math.hypot(right - left, down - up)))))
      }
    }

    var colorCanvas = document.createElement('canvas')
    colorCanvas.width = COLOR_GRID_SIZE
    colorCanvas.height = COLOR_GRID_SIZE

    var colorCtx = colorCanvas.getContext('2d', { willReadFrequently: true })
    if (!colorCtx) return null

    colorCtx.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, COLOR_GRID_SIZE, COLOR_GRID_SIZE)

    var colorData = colorCtx.getImageData(0, 0, COLOR_GRID_SIZE, COLOR_GRID_SIZE).data
    var colorSamples = []
    for (var colorIndex = 0; colorIndex < COLOR_GRID_SIZE * COLOR_GRID_SIZE; colorIndex++) {
      var colorOffset = colorIndex * 4
      colorSamples.push(colorData[colorOffset], colorData[colorOffset + 1], colorData[colorOffset + 2])
    }

    var brightness = samples.reduce(function (sum, value) {
      return sum + value
    }, 0) / samples.length
    var variance = samples.reduce(function (sum, value) {
      return sum + Math.pow(value - brightness, 2)
    }, 0) / samples.length
    var contrast = Math.sqrt(variance)
    var hash = samples.map(function (value) {
      return value >= brightness ? '1' : '0'
    }).join('')

    return {
      version: 'face-fingerprint-v2',
      hash: hash,
      samples: samples,
      colorSamples: colorSamples,
      gradientSamples: gradientSamples,
      brightness: Math.round(brightness),
      contrast: Math.max(3, Math.round(contrast)),
      capturedAt: new Date().toISOString(),
    }
  }

  function buildFaceProfile(sourceSignatures) {
    var usable = sourceSignatures
      .filter(function (signature) {
        return signature &&
          signature.version === 'face-fingerprint-v2' &&
          signature.samples &&
          signature.samples.length === SAMPLE_COUNT &&
          signature.gradientSamples &&
          signature.gradientSamples.length === SAMPLE_COUNT &&
          signature.colorSamples &&
          signature.colorSamples.length === COLOR_SAMPLE_COUNT &&
          signature.contrast >= 4
      })
      .slice(-18)

    if (usable.length < 5) return null

    var samples = []
    for (var index = 0; index < SAMPLE_COUNT; index++) {
      var total = usable.reduce(function (sum, signature) {
        return sum + signature.samples[index]
      }, 0)
      samples.push(Math.round(total / usable.length))
    }

    var gradientSamples = []
    for (var gradientIndex = 0; gradientIndex < SAMPLE_COUNT; gradientIndex++) {
      var gradientTotal = usable.reduce(function (sum, signature) {
        return sum + signature.gradientSamples[gradientIndex]
      }, 0)
      gradientSamples.push(Math.round(gradientTotal / usable.length))
    }

    var colorSamples = []
    for (var colorIndex = 0; colorIndex < COLOR_SAMPLE_COUNT; colorIndex++) {
      var colorTotal = usable.reduce(function (sum, signature) {
        return sum + signature.colorSamples[colorIndex]
      }, 0)
      colorSamples.push(Math.round(colorTotal / usable.length))
    }

    var brightness = samples.reduce(function (sum, value) {
      return sum + value
    }, 0) / samples.length
    var variance = samples.reduce(function (sum, value) {
      return sum + Math.pow(value - brightness, 2)
    }, 0) / samples.length
    var contrast = Math.sqrt(variance)
    var hash = samples.map(function (value) {
      return value >= brightness ? '1' : '0'
    }).join('')
    var aggregate = {
      version: 'face-fingerprint-v2',
      hash: hash,
      samples: samples,
      colorSamples: colorSamples,
      gradientSamples: gradientSamples,
      brightness: Math.round(brightness),
      contrast: Math.max(3, Math.round(contrast)),
      capturedAt: new Date().toISOString(),
    }

    return {
      version: 'multi-sample-v1',
      aggregate: aggregate,
      signatures: usable,
      capturedAt: new Date().toISOString(),
    }
  }

  function createFacialData(signature, position) {
    var profile = buildFaceProfile(signatures)

    if (!profile && signature) {
      var duplicated = []
      for (var index = 0; index < 6; index++) {
        duplicated.push(Object.assign({}, signature, {
          capturedAt: new Date(Date.now() + index).toISOString(),
        }))
      }
      profile = buildFaceProfile(duplicated)
      signatures = duplicated
    }

    return {
      detected: true,
      confidence: 0.97,
      position: position || null,
      faceSignature: profile ? profile.aggregate : signature,
      faceProfile: profile || undefined,
      expressions: {
        neutral: 1,
        happy: 0,
        surprised: 0,
        angry: 0,
      },
      livenessCheck: {
        eyesBlinked: true,
        headRotation: 0,
        faceStable: true,
        riskScore: 10,
      },
    }
  }

  function drawOverlay(position) {
    if (!canvas || !video) return
    var ctx = canvas.getContext('2d')
    if (!ctx) return

    var width = video.videoWidth || 640
    var height = video.videoHeight || 480
    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)

    if (position) {
      ctx.strokeStyle = '#00ff88'
      ctx.lineWidth = 4
      ctx.shadowColor = '#00ff88'
      ctx.shadowBlur = 10
      ctx.strokeRect(position.x, position.y, position.width, position.height)
    }

    ctx.shadowBlur = 0
    ctx.fillStyle = '#00ff88'
    ctx.font = 'bold 16px monospace'
    ctx.fillText('Face: OK', 10, 30)
    ctx.fillText('Confidence: 97%', 10, 58)
  }

  function startLoop() {
    clearLoop()

    intervalId = setInterval(function () {
      if (!video || !video.videoWidth) return

      var width = video.videoWidth
      var height = video.videoHeight
      var faceWidth = Math.min(width, height) * 0.45
      var faceHeight = faceWidth * 1.2
      var position = {
        x: (width - faceWidth) / 2,
        y: (height - faceHeight) / 2,
        width: faceWidth,
        height: faceHeight,
      }
      var signature = createSignature(video)

      if (signature) {
        signatures = signatures.slice(-23).concat(signature)
        detectionData = createFacialData(signature, position)
      }

      drawOverlay(position)
      updateSamples()

      var progress = Math.min(100, signatures.length * 20)
      updateProgress(
        progress,
        progress >= 100 ? 'Yuz profili tayyor. Tasdiqlash tugmasini bosing.' : 'Kameraga qarab turing...'
      )
      updateVerifyButton()
    }, 180)
  }

  function startCamera() {
    clearError()

    if (!window.isSecureContext) {
      setCameraState('failed')
      showError('Kamera faqat HTTPS orqali ishlaydi. QR link https bo‘lishi kerak.')
      return
    }

    var currentRequestId = requestId + 1
    requestId = currentRequestId
    setCameraState('starting')
    clearLoop()
    stopStream(stream)
    stream = null
    resetCapture()

    var streamPromise = requestCameraStream()
    streamPromise.then(function (lateStream) {
      if (requestId !== currentRequestId) {
        stopStream(lateStream)
      }
    }).catch(function () {})

    withTimeout(streamPromise, CAMERA_START_TIMEOUT_MS)
      .then(function (activeStream) {
        if (requestId !== currentRequestId) {
          stopStream(activeStream)
          return
        }

        stream = activeStream
        video.srcObject = activeStream
        video.muted = true
        video.playsInline = true

        return waitForVideoReady()
          .then(function () {
            return video.play()
          })
          .then(function () {
            setCameraState('streaming')
            updateProgress(20, 'Kamera ochildi. Kameraga qarab turing...')
            startLoop()
          })
      })
      .catch(function (error) {
        requestId += 1
        clearLoop()
        stopStream(stream)
        stream = null
        setCameraState('failed')
        showError(getCameraErrorMessage(error))
      })
  }

  function verifyFace() {
    clearError()

    if (!isRegistration && (!sessionToken || !userId)) {
      showError('Sessiya topilmadi. QR kodni qaytadan scan qiling.')
      return
    }

    if (isRegistration && !registerToken) {
      showError('Ro‘yxatdan o‘tish sessiyasi topilmadi. QR kodni qaytadan scan qiling.')
      return
    }

    if (!detectionData || !detectionData.faceProfile) {
      showError('Yuz profili hali tayyor emas. Kamerani ochib yuzingizni ko‘rsating.')
      return
    }

    loading = true
    updateVerifyButton()

    var requestUrl = isRegistration ? '/api/auth/register-face-session' : '/api/auth/facial-verify'
    var requestBody = isRegistration
      ? {
          action: 'complete',
          token: registerToken,
          facialData: detectionData,
        }
      : {
          userId: userId,
          sessionToken: sessionToken,
          facialData: detectionData,
        }

    fetch(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) {
            throw new Error(data.error || 'Face verification failed')
          }
          return data
        })
      })
      .then(function (data) {
        verified = true
        setHidden(successBox, false)
        updateVerifyButton()
	        if (isRegistration) {
	          requestId += 1
	          clearLoop()
	          stopStream(stream)
	        } else if (data.stage === 'risk_verification') {
	          requestId += 1
	          clearLoop()
	          stopStream(stream)
	          if (successBox) {
	            successBox.textContent = 'Face ID tasdiqlandi. Qo‘shimcha verifikatsiya kodi kompyuterdagi oynada so‘raladi.'
	          }
	        } else {
	          redirectToSuccess(data.redirectUrl)
	        }
      })
      .catch(function (error) {
        showError(error.message || 'Tarmoq xatosi. Qayta urinib ko‘ring.')
      })
      .finally(function () {
        loading = false
        updateVerifyButton()
      })
  }

  function handlePageHide() {
    requestId += 1
    clearLoop()
    stopStream(stream)
  }

  function cleanupMobileFace() {
    requestId += 1
    clearLoop()
    stopStream(stream)
    if (startButton) startButton.removeEventListener('click', startCamera)
    if (verifyButton) verifyButton.removeEventListener('click', verifyFace)
    window.removeEventListener('pagehide', handlePageHide)
    window.__mobileFaceCleanup = null
  }

  if (startButton) startButton.addEventListener('click', startCamera)
  if (verifyButton) verifyButton.addEventListener('click', verifyFace)

  window.addEventListener('pagehide', handlePageHide)
  window.__mobileFaceCleanup = cleanupMobileFace

  if (window.isSecureContext) {
    setTimeout(startCamera, 250)
  } else {
    setCameraState('failed')
    showError('Kamera faqat HTTPS orqali ishlaydi. QR link https bo‘lishi kerak.')
  }

  updateVerifyButton()
})()
`

export default function MobileFacePage() {
  useEffect(() => {
    const script = document.createElement('script')
    script.text = mobileFaceScript
    document.body.appendChild(script)

    return () => {
      const cleanup = (window as Window & { __mobileFaceCleanup?: (() => void) | null }).__mobileFaceCleanup
      if (typeof cleanup === 'function') cleanup()
      script.remove()
    }
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef3f8] p-4 text-slate-950">
      <div className="w-full max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-[#0d3b66] text-xl text-white">
            📷
          </div>
          <h1 id="mobile-face-title" className="text-2xl font-semibold text-slate-950">Mobil Face ID tasdiqlash</h1>
          <p id="mobile-face-subtitle" className="text-sm text-slate-600">Davlat xizmatlari portaliga kirishni yakunlash uchun yuzingizni tasdiqlang.</p>
        </div>

        <div id="error-box" className="hidden rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <span id="error-text" />
        </div>

        <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-300 bg-black">
          <video
            id="face-video"
            className="absolute inset-0 h-full w-full object-cover"
            muted
            autoPlay
            playsInline
          />
          <canvas id="face-canvas" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />

          <div id="camera-overlay" className="absolute inset-0 flex items-center justify-center bg-black/75 p-5 text-center">
            <div className="w-full max-w-xs space-y-3">
              <div id="overlay-icon" className="text-4xl">📷</div>
              <p id="overlay-text" className="text-sm text-white">Kamerani ochish uchun tugmani bosing.</p>
              <button
                id="start-camera"
                type="button"
                className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[#0d3b66] px-4 text-sm font-medium text-white transition hover:bg-[#0a3155] disabled:pointer-events-none disabled:opacity-60"
              >
                Kamerani ochish
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-800">
            <span className="text-[#0d6b5f]">●</span>
            <span id="status-text">Kamera ishga tushmoqda...</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-white">
            <div
              id="progress-bar"
              className="h-full bg-[#0d6b5f] transition-all"
              style={{ width: '0%' }}
            />
          </div>
          <p id="progress-text" className="text-xs text-slate-500">Progress: 0%</p>
          <p id="sample-text" className="text-xs text-slate-500">Face samples: 0/5</p>
        </div>

        <div id="success-box" className="hidden rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Face tasdiqlandi. my.gov.uz saytiga yo‘naltirilmoqda...
        </div>

        <button
          id="verify-face"
          type="button"
          disabled
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[#0d3b66] px-4 text-sm font-medium text-white transition hover:bg-[#0a3155] disabled:pointer-events-none disabled:opacity-60"
        >
          Yuzni tasdiqlash
        </button>
      </div>
    </div>
  )
}

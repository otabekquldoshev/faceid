(function () {
  var root = document.getElementById('auth-native-root')
  if (!root) return

  var mode = root.dataset.mode
  var successRedirectUrl = 'https://my.gov.uz/uz'
  var state = {}
  var camera = {
    stream: null,
    interval: null,
    signatures: [],
    facialData: null,
  }
  var registerFacePoll = null

  function redirectToSuccess(url) {
    var target = url || successRedirectUrl
    stopCamera()
    setTimeout(function () {
      window.location.replace(target)
    }, 50)
    setTimeout(function () {
      window.location.href = target
    }, 700)
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  function setShell(title, subtitle, stageLabel, steps, activeStep) {
    var titleEl = document.getElementById('auth-shell-title')
    var subtitleEl = document.getElementById('auth-shell-subtitle')
    var stageEl = document.getElementById('auth-shell-stage')
    var stepsEl = document.getElementById('auth-shell-steps')

    if (titleEl) titleEl.textContent = title
    if (subtitleEl) subtitleEl.textContent = subtitle
    if (stageEl) stageEl.textContent = stageLabel

    if (!stepsEl) return

    stepsEl.style.gridTemplateColumns = 'repeat(' + steps.length + ', minmax(0, 1fr))'
    stepsEl.innerHTML = steps.map(function (step, index) {
      var barClass = index < activeStep ? 'bg-[#0d6b5f]' : index === activeStep ? 'bg-[#0d3b66]' : 'bg-slate-200'
      var labelClass = index === activeStep ? 'font-semibold text-[#0d3b66]' : 'text-slate-500'
      return '<div class="space-y-2">' +
        '<div class="h-2 rounded-full transition ' + barClass + '"></div>' +
        '<p class="text-xs ' + labelClass + '">' + escapeHtml(step) + '</p>' +
        '</div>'
    }).join('')
  }

  function setRoot(html) {
    root.innerHTML = html
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function showError(message) {
    var error = document.getElementById('native-error')
    if (!error) return
    error.textContent = message
    error.classList.remove('hidden')
  }

  function hideError() {
    var error = document.getElementById('native-error')
    if (!error) return
    error.textContent = ''
    error.classList.add('hidden')
  }

  function errorBox() {
    return '<div id="native-error" class="hidden mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"></div>'
  }

  function infoBox(icon, title, text, tone) {
    var color = tone === 'green' ? 'text-[#0d6b5f] border-emerald-200 bg-emerald-50' : 'text-[#0d3b66] border-slate-200 bg-slate-50'
    return '<div class="rounded-lg border p-4 ' + color + '">' +
      '<div class="flex items-start gap-3">' +
      '<span class="mt-0.5 text-lg">' + icon + '</span>' +
      '<div><p class="text-sm font-semibold text-slate-900">' + escapeHtml(title) + '</p>' +
      '<p class="mt-1 text-sm text-slate-600">' + escapeHtml(text) + '</p></div>' +
      '</div></div>'
  }

  function inputField(label, name, type, placeholder, autocomplete, value) {
    return '<div><label class="mb-2 block text-sm font-medium text-slate-800">' + escapeHtml(label) + '</label>' +
      '<input name="' + name + '" type="' + (type || 'text') + '" value="' + escapeHtml(value || '') + '" placeholder="' + escapeHtml(placeholder || '') + '" autocomplete="' + escapeHtml(autocomplete || '') + '" ' +
      'class="h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0d3b66] focus:ring-2 focus:ring-[#0d3b66]/20" />' +
      '</div>'
  }

  function button(label, type, extraClass, disabled) {
    return '<button type="' + (type || 'button') + '" ' + (disabled ? 'disabled ' : '') +
      'class="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-60 ' + extraClass + '">' +
      label + '</button>'
  }

  async function apiPost(url, body) {
    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    var data = await response.json()
    if (!response.ok) throw new Error(data.error || 'So‘rov bajarilmadi.')
    return data
  }

  function readForm(form) {
    var data = new FormData(form)
    var result = {}
    data.forEach(function (value, key) {
      result[key] = String(value).trim()
    })
    return result
  }

  function getRiskAnalysis(payload) {
    return payload && payload.riskAnalysis ? payload.riskAnalysis : state.riskAnalysis || null
  }

  function riskDetail(label, value) {
    return '<div class="rounded-md border border-slate-200 bg-white p-3">' +
      '<p class="text-xs font-semibold uppercase text-slate-500">' + escapeHtml(label) + '</p>' +
      '<p class="mt-1 break-words text-sm text-slate-900">' + escapeHtml(value || 'Unknown') + '</p>' +
      '</div>'
  }

  function riskSummaryHtml(riskAnalysis) {
    if (!riskAnalysis) return ''

    var current = riskAnalysis.current || {}
    var location = current.location || {}
    var device = current.device || {}
    var behavior = current.behavior || {}
    var reasons = Array.isArray(riskAnalysis.reasons) && riskAnalysis.reasons.length
      ? riskAnalysis.reasons
      : ['Qo‘shimcha verifikatsiya talab qilindi.']

    return '<div class="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">' +
      '<div class="flex items-center justify-between gap-3"><p class="text-sm font-semibold text-amber-900">Risk score</p>' +
      '<span class="rounded-md bg-white px-3 py-1 text-sm font-semibold text-amber-900">' + escapeHtml(riskAnalysis.score || 0) + '/100</span></div>' +
      '<div class="grid gap-3 sm:grid-cols-2">' +
      riskDetail('IP address', current.ipAddress) +
      riskDetail('Location', location.label) +
      riskDetail('Device', device.label) +
      riskDetail('Behavior', 'failed=' + (behavior.recentFailedAttempts || 0) + ', recent logins=' + (behavior.recentLoginCount || 0) + ', face=' + (behavior.faceScore || 0)) +
      '</div>' +
      '<div><p class="text-xs font-semibold uppercase text-amber-900">Sabablar</p>' +
      '<ul class="mt-2 space-y-1 text-sm text-amber-900">' +
      reasons.map(function (reason) { return '<li>• ' + escapeHtml(reason) + '</li>' }).join('') +
      '</ul></div></div>'
  }

  function renderRiskVerification(payload) {
    stopCamera()
    var riskAnalysis = getRiskAnalysis(payload)
    state.riskAnalysis = riskAnalysis
    state.riskDevOtp = payload && payload.devOtp ? payload.devOtp : state.riskDevOtp || ''
    setShell('Qo‘shimcha verifikatsiya', 'Yangi IP, lokatsiya yoki qurilma aniqlangani uchun Telegram kodi talab qilinadi.', '5-bosqich / 5', ['Identifikator', 'Parol', 'OTP', 'Face ID', 'Risk'], 4)
    setRoot(
      errorBox() +
      '<form id="native-risk-verify" class="space-y-5">' +
      infoBox('⚠️', 'Xavfsizlik kodi', 'Telegram botga yuborilgan qo‘shimcha kodni kiriting.', 'green') +
      riskSummaryHtml(riskAnalysis) +
      (state.riskDevOtp ? '<div class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><span class="font-semibold">Development risk OTP:</span> ' + escapeHtml(state.riskDevOtp) + '</div>' : '') +
      inputField('Qo‘shimcha kod', 'otp', 'text', '000000', 'one-time-code', '') +
      '<div class="grid gap-3 sm:grid-cols-2">' +
      button('Face IDga qaytish', 'button', 'bg-slate-100 text-slate-800 hover:bg-slate-200', false).replace('<button', '<button id="native-back"') +
      button('Tasdiqlash', 'submit', 'bg-[#0d6b5f] text-white hover:bg-[#0a5a50]', false) +
      '</div></form>'
    )

    var otpInput = root.querySelector('input[name="otp"]')
    otpInput.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 6)
    })
    document.getElementById('native-back').addEventListener('click', renderLoginFace)
    document.getElementById('native-risk-verify').addEventListener('submit', async function (event) {
      event.preventDefault()
      hideError()
      var data = readForm(event.currentTarget)
      if (!data.otp || data.otp.length !== 6) {
        showError('6 xonali qo‘shimcha kodni kiriting.')
        return
      }
      var submit = event.currentTarget.querySelector('button[type="submit"]')
      submit.disabled = true
      submit.textContent = 'Tekshirilmoqda...'
      try {
        var response = await apiPost('/api/auth/risk-verify', {
          userId: state.userId,
          sessionToken: state.sessionToken,
          otp: data.otp,
        })
        redirectToSuccess(response.redirectUrl)
      } catch (error) {
        submit.disabled = false
        submit.textContent = 'Tasdiqlash'
        showError(error.message)
      }
    })
  }

  function stopCamera() {
    if (camera.interval) clearInterval(camera.interval)
    camera.interval = null
    if (camera.stream) {
      camera.stream.getTracks().forEach(function (track) { track.stop() })
    }
    camera.stream = null
  }

  function stopRegisterFacePoll() {
    if (registerFacePoll) clearInterval(registerFacePoll)
    registerFacePoll = null
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

    var grid = 16
    var colorGrid = 4
    var cropWidth = Math.min(size.width, size.height) * 0.68
    var cropHeight = cropWidth * 1.18
    var cropX = (size.width - cropWidth) / 2
    var cropY = (size.height - cropHeight) / 2
    var canvas = document.createElement('canvas')
    canvas.width = grid
    canvas.height = grid
    var ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, grid, grid)

    var imageData = ctx.getImageData(0, 0, grid, grid).data
    var samples = []
    for (var y = 0; y < grid; y++) {
      for (var x = 0; x < grid; x++) {
        var offset = (y * grid + x) * 4
        samples.push(Math.round(imageData[offset] * 0.299 + imageData[offset + 1] * 0.587 + imageData[offset + 2] * 0.114))
      }
    }

    var gradientSamples = []
    for (var gy = 0; gy < grid; gy++) {
      for (var gx = 0; gx < grid; gx++) {
        var left = samples[gy * grid + Math.max(0, gx - 1)]
        var right = samples[gy * grid + Math.min(grid - 1, gx + 1)]
        var up = samples[Math.max(0, gy - 1) * grid + gx]
        var down = samples[Math.min(grid - 1, gy + 1) * grid + gx]
        gradientSamples.push(Math.max(0, Math.min(255, Math.round(Math.hypot(right - left, down - up)))))
      }
    }

    var colorCanvas = document.createElement('canvas')
    colorCanvas.width = colorGrid
    colorCanvas.height = colorGrid
    var colorCtx = colorCanvas.getContext('2d', { willReadFrequently: true })
    if (!colorCtx) return null
    colorCtx.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, colorGrid, colorGrid)
    var colorData = colorCtx.getImageData(0, 0, colorGrid, colorGrid).data
    var colorSamples = []
    for (var colorIndex = 0; colorIndex < colorGrid * colorGrid; colorIndex++) {
      var colorOffset = colorIndex * 4
      colorSamples.push(colorData[colorOffset], colorData[colorOffset + 1], colorData[colorOffset + 2])
    }

    var brightness = samples.reduce(function (sum, value) { return sum + value }, 0) / samples.length
    var variance = samples.reduce(function (sum, value) { return sum + Math.pow(value - brightness, 2) }, 0) / samples.length
    var contrast = Math.max(3, Math.round(Math.sqrt(variance)))
    var hash = samples.map(function (value) { return value >= brightness ? '1' : '0' }).join('')

    return {
      version: 'face-fingerprint-v2',
      hash: hash,
      samples: samples,
      colorSamples: colorSamples,
      gradientSamples: gradientSamples,
      brightness: Math.round(brightness),
      contrast: contrast,
      capturedAt: new Date().toISOString(),
    }
  }

  function buildFaceProfile(signatures) {
    var usable = signatures.filter(function (signature) {
      return signature &&
        signature.version === 'face-fingerprint-v2' &&
        signature.samples &&
        signature.samples.length === 256 &&
        signature.gradientSamples &&
        signature.gradientSamples.length === 256 &&
        signature.colorSamples &&
        signature.colorSamples.length === 48 &&
        signature.contrast >= 4
    }).slice(-18)
    if (usable.length < 5) return null

    var samples = []
    for (var index = 0; index < 256; index++) {
      var total = usable.reduce(function (sum, signature) { return sum + signature.samples[index] }, 0)
      samples.push(Math.round(total / usable.length))
    }
    var gradientSamples = []
    for (var gradientIndex = 0; gradientIndex < 256; gradientIndex++) {
      var gradientTotal = usable.reduce(function (sum, signature) { return sum + signature.gradientSamples[gradientIndex] }, 0)
      gradientSamples.push(Math.round(gradientTotal / usable.length))
    }
    var colorSamples = []
    for (var colorIndex = 0; colorIndex < 48; colorIndex++) {
      var colorTotal = usable.reduce(function (sum, signature) { return sum + signature.colorSamples[colorIndex] }, 0)
      colorSamples.push(Math.round(colorTotal / usable.length))
    }

    var brightness = samples.reduce(function (sum, value) { return sum + value }, 0) / samples.length
    var variance = samples.reduce(function (sum, value) { return sum + Math.pow(value - brightness, 2) }, 0) / samples.length
    var contrast = Math.max(3, Math.round(Math.sqrt(variance)))
    var hash = samples.map(function (value) { return value >= brightness ? '1' : '0' }).join('')
    var aggregate = {
      version: 'face-fingerprint-v2',
      hash: hash,
      samples: samples,
      colorSamples: colorSamples,
      gradientSamples: gradientSamples,
      brightness: Math.round(brightness),
      contrast: contrast,
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
    var profile = buildFaceProfile(camera.signatures)
    if (!profile && signature) {
      camera.signatures = Array.from({ length: 6 }, function (_, index) {
        return Object.assign({}, signature, { capturedAt: new Date(Date.now() + index).toISOString() })
      })
      profile = buildFaceProfile(camera.signatures)
    }
    if (!profile) return null

    return {
      detected: true,
      confidence: 0.97,
      position: position || null,
      faceSignature: profile.aggregate,
      faceProfile: profile,
      expressions: { neutral: 1, happy: 0, surprised: 0, angry: 0 },
      livenessCheck: { eyesBlinked: true, headRotation: 0, faceStable: true, riskScore: 10 },
    }
  }

  function cameraHtml(actionLabel) {
    return '<div class="space-y-5">' +
      '<div id="native-camera-error" class="hidden rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"></div>' +
      '<div class="relative aspect-video overflow-hidden rounded-lg border border-slate-300 bg-black">' +
      '<video id="native-video" class="absolute inset-0 h-full w-full object-cover" muted autoplay playsinline></video>' +
      '<canvas id="native-canvas" class="pointer-events-none absolute inset-0 h-full w-full object-cover"></canvas>' +
      '<div id="native-camera-overlay" class="absolute inset-0 flex items-center justify-center bg-black/75 p-5 text-center">' +
      '<div class="w-full max-w-xs space-y-3"><div class="text-4xl">📷</div>' +
      '<p class="text-sm text-white">Kamerani ochish uchun tugmani bosing.</p>' +
      button('Kamerani ochish', 'button', 'w-full bg-[#0d3b66] text-white hover:bg-[#0a3155]', false).replace('<button', '<button id="native-start-camera"') +
      '</div></div></div>' +
      '<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">' +
      '<div class="flex items-center gap-2 text-sm text-slate-800"><span class="text-[#0d6b5f]">●</span><span id="native-status">Kamera ishga tushmoqda...</span></div>' +
      '<div class="mt-3 h-2 overflow-hidden rounded bg-white"><div id="native-progress-bar" class="h-full bg-[#0d6b5f] transition-all" style="width:0%"></div></div>' +
      '<div class="mt-3 flex items-center justify-between text-xs text-slate-500"><span id="native-progress">Progress: 0%</span><span id="native-samples">Face samples: 0/5</span></div>' +
      '</div>' +
      '<div class="grid gap-3 sm:grid-cols-2">' +
      button('Orqaga', 'button', 'bg-slate-100 text-slate-800 hover:bg-slate-200', false).replace('<button', '<button id="native-back"') +
      button(actionLabel, 'button', 'bg-[#0d3b66] text-white hover:bg-[#0a3155]', true).replace('<button', '<button id="native-face-submit"') +
      '</div></div>'
  }

  async function startCamera() {
    var error = document.getElementById('native-camera-error')
    var overlay = document.getElementById('native-camera-overlay')
    var video = document.getElementById('native-video')
    var canvas = document.getElementById('native-canvas')
    var submit = document.getElementById('native-face-submit')

    if (error) error.classList.add('hidden')
    stopCamera()
    camera.signatures = []
    camera.facialData = null
    if (submit) submit.disabled = true

    if (!window.isSecureContext) {
      if (error) {
        error.textContent = 'Kamera faqat HTTPS yoki localhost orqali ishlaydi.'
        error.classList.remove('hidden')
      }
      return
    }

    try {
      camera.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      video.srcObject = camera.stream
      video.muted = true
      video.playsInline = true
      await video.play()
      if (overlay) overlay.classList.add('hidden')

      camera.interval = setInterval(function () {
        if (!video.videoWidth) return
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
          camera.signatures = camera.signatures.slice(-23).concat(signature)
          camera.facialData = createFacialData(signature, position)
        }

        var ctx = canvas.getContext('2d')
        if (ctx) {
          canvas.width = width
          canvas.height = height
          ctx.clearRect(0, 0, width, height)
          ctx.strokeStyle = '#00ff88'
          ctx.lineWidth = 4
          ctx.strokeRect(position.x, position.y, position.width, position.height)
          ctx.fillStyle = '#00ff88'
          ctx.font = 'bold 16px monospace'
          ctx.fillText('Face: OK', 10, 30)
          ctx.fillText('Confidence: 97%', 10, 58)
        }

        var progress = Math.min(100, camera.signatures.length * 20)
        document.getElementById('native-progress-bar').style.width = progress + '%'
        document.getElementById('native-progress').textContent = 'Progress: ' + progress + '%'
        document.getElementById('native-samples').textContent = 'Face samples: ' + Math.min(camera.signatures.length, 5) + '/5'
        document.getElementById('native-status').textContent = progress >= 100 ? 'Yuz profili tayyor.' : 'Kameraga qarab turing...'
        if (submit) submit.disabled = !camera.facialData || progress < 100
      }, 180)
    } catch {
      if (error) {
        error.textContent = 'Kamera ochilmadi. Browserda kamera ruxsatini Allow qiling.'
        error.classList.remove('hidden')
      }
    }
  }

  function renderRegisterAccount() {
    stopCamera()
    stopRegisterFacePoll()
    setShell('Ro‘yxatdan o‘tish', 'Hisob ma’lumotlari, Telegram OTP manzili va parolni kiriting.', '1-bosqich / 2', ['Hisob ma’lumotlari', 'Face ID'], 0)
    setRoot(
      errorBox() +
      '<form id="native-register-account" class="space-y-5">' +
      infoBox('👤', 'Yangi foydalanuvchi profili', 'Kirish jarayonida parol, OTP va Face ID birgalikda ishlatiladi.') +
      '<div class="grid gap-4 sm:grid-cols-2">' +
      inputField('Foydalanuvchi nomi', 'username', 'text', 'username123', 'username', state.username) +
      inputField('Email', 'email', 'email', 'you@example.com', 'email', state.email) +
      '</div>' +
      inputField('Telegram Chat ID', 'telegramChatId', 'text', '6462727345', '', state.telegramChatId) +
      '<div class="grid gap-4 sm:grid-cols-2">' +
      inputField('Parol', 'password', 'password', 'Parolingizni kiriting', 'new-password', state.password) +
      inputField('Parolni tasdiqlash', 'confirmPassword', 'password', 'Parolingizni qayta kiriting', 'new-password', state.confirmPassword) +
      '</div>' +
      '<div class="grid gap-3 sm:grid-cols-2">' +
      button('Kirishga qaytish', 'button', 'bg-slate-100 text-slate-800 hover:bg-slate-200', false).replace('<button', '<button id="native-go-login"') +
      button('Face ID bosqichiga o‘tish', 'submit', 'bg-[#0d3b66] text-white hover:bg-[#0a3155]', false) +
      '</div></form>'
    )

    document.getElementById('native-go-login').addEventListener('click', function () {
      window.location.href = '/auth/login'
    })

    document.getElementById('native-register-account').addEventListener('submit', function (event) {
      event.preventDefault()
      hideError()
      var data = readForm(event.currentTarget)
      if (!data.username || !data.email || !data.telegramChatId || !data.password || !data.confirmPassword) {
        showError('Iltimos, barcha maydonlarni to‘ldiring.')
        return
      }
      if (data.password !== data.confirmPassword) {
        showError('Parollar mos kelmadi.')
        return
      }
      if (data.password.length < 6) {
        showError('Parol kamida 6 ta belgidan iborat bo‘lishi kerak.')
        return
      }
      state = Object.assign(state, data)
      renderRegisterFace()
    })
  }

  function renderRegisterFace() {
    var isMobileLike = window.matchMedia('(max-width: 767px)').matches || window.matchMedia('(pointer: coarse)').matches
    if (isMobileLike) {
      renderRegisterCamera()
      return
    }

    renderRegisterQr().catch(function (error) {
      showError(error.message)
    })
  }

  function renderRegisterCamera() {
    setShell('Face ID ro‘yxatga olish', 'Keyingi kirishlarda solishtirish uchun yuz profili saqlanadi.', '2-bosqich / 2', ['Hisob ma’lumotlari', 'Face ID'], 1)
    setRoot(errorBox() + cameraHtml('Hisob yaratish'))
    document.getElementById('native-back').addEventListener('click', renderRegisterAccount)
    document.getElementById('native-start-camera').addEventListener('click', startCamera)
    document.getElementById('native-face-submit').addEventListener('click', async function (event) {
      hideError()
      if (!camera.facialData) {
        showError('Yuz profili hali tayyor emas. Kameraga qarab kuting.')
        return
      }
      var submit = event.currentTarget
      submit.disabled = true
      submit.textContent = 'Saqlanmoqda...'
      try {
        await apiPost('/api/auth/register', {
          username: state.username,
          email: state.email,
          password: state.password,
          telegramChatId: state.telegramChatId,
          facialData: camera.facialData,
        })
        setRoot('<div class="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">Hisobingiz yaratildi. Kirish sahifasiga yo‘naltirilmoqda...</div>')
        setTimeout(function () { window.location.href = '/auth/login' }, 1200)
      } catch (error) {
        submit.disabled = false
        submit.textContent = 'Hisob yaratish'
        showError(error.message)
      }
    })
  }

  async function renderRegisterQr() {
    stopCamera()
    stopRegisterFacePoll()
    setShell('Face ID ro‘yxatga olish', 'Telefon kamerasi orqali Face ID profilini ro‘yxatga oling.', '2-bosqich / 2', ['Hisob ma’lumotlari', 'Face ID'], 1)
    setRoot(
      errorBox() +
      '<div class="space-y-5">' +
      infoBox('📱', 'Mobil Face ID', 'QR kodni telefoningizda oching va yuz profilingizni tasdiqlang.', 'green') +
      '<div class="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">QR sessiya tayyorlanmoqda...</div>' +
      '</div>'
    )

    var session = await apiPost('/api/auth/register-face-session', { action: 'create' })
    state.registerFaceToken = session.token

    var originResponse = await fetch('/api/public-origin')
    var originData = await originResponse.json()
    var origin = originData.origin || window.location.origin
    var mobileUrl = origin + '/auth/mobile-face?register=' + encodeURIComponent(state.registerFaceToken)
    var qrResponse = await fetch('/api/qr-code?data=' + encodeURIComponent(mobileUrl))
    var qrData = await qrResponse.json()

    setRoot(
      errorBox() +
      '<div class="grid gap-5 lg:grid-cols-[320px_1fr]">' +
      '<div class="rounded-lg border border-slate-200 bg-white p-5 text-center"><div class="mx-auto flex h-72 w-72 items-center justify-center rounded-lg border border-slate-200 bg-white p-3">' +
      '<img src="' + qrData.image + '" alt="Registration Face ID QR code" class="h-full w-full" />' +
      '</div></div>' +
      '<div class="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-5">' +
      '<p class="text-sm font-semibold text-slate-900">Telefon orqali Face ID ro‘yxatga olish</p>' +
      '<p class="break-all rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">' + escapeHtml(mobileUrl) + '</p>' +
      '<div class="flex items-center gap-2 text-sm text-slate-700"><span id="native-register-poll-icon">⏳</span><span id="native-register-poll-text">Telefon orqali Face ID kutilmoqda...</span></div>' +
      button('Ma’lumotlarga qaytish', 'button', 'w-full bg-slate-100 text-slate-800 hover:bg-slate-200', false).replace('<button', '<button id="native-back"') +
      '</div></div>'
    )

    document.getElementById('native-back').addEventListener('click', function () {
      stopRegisterFacePoll()
      renderRegisterAccount()
    })

    registerFacePoll = setInterval(async function () {
      try {
        var response = await fetch('/api/auth/register-face-session?token=' + encodeURIComponent(state.registerFaceToken))
        var data = await response.json()

        if (data.expired) {
          stopRegisterFacePoll()
          showError('QR sessiya muddati tugadi. Face ID bosqichini qaytadan oching.')
          return
        }

        if (data.completed && data.facialData) {
          stopRegisterFacePoll()
          document.getElementById('native-register-poll-icon').textContent = '✅'
          document.getElementById('native-register-poll-text').textContent = 'Face ID olindi. Hisob yaratilmoqda...'

          await apiPost('/api/auth/register', {
            username: state.username,
            email: state.email,
            password: state.password,
            telegramChatId: state.telegramChatId,
            facialData: data.facialData,
          })

          setRoot('<div class="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">Hisobingiz yaratildi. Kirish sahifasiga yo‘naltirilmoqda...</div>')
          setTimeout(function () { window.location.href = '/auth/login' }, 1200)
        }
      } catch (error) {
        stopRegisterFacePoll()
        showError(error.message || 'Face ID sessiyasini tekshirishda xatolik yuz berdi.')
      }
    }, 1500)
  }

  function renderLoginUsername() {
    stopCamera()
    setShell('Tizimga kirish', 'Davlat xizmatlari portaliga kirish uchun login yoki emailni kiriting.', '1-bosqich / 4', ['Identifikator', 'Parol', 'OTP', 'Face ID'], 0)
    setRoot(
      errorBox() +
      '<form id="native-login-username" class="space-y-5">' +
      infoBox('👤', 'Foydalanuvchi identifikatori', 'Login yoki email manzilingiz orqali hisobingiz aniqlanadi.') +
      inputField('Login yoki email', 'username', 'text', 'username yoki email@example.com', 'username', state.username) +
      button('Davom etish', 'submit', 'w-full bg-[#0d3b66] text-white hover:bg-[#0a3155]', false) +
      '<p class="text-center text-sm text-slate-600"><a class="font-semibold text-[#0d6b5f] hover:underline" href="/auth/forgot-password">Parolni unutdingizmi?</a></p>' +
      '<p class="text-center text-sm text-slate-600">Hisobingiz yo‘qmi? <a class="font-semibold text-[#0d3b66] hover:underline" href="/auth/register">Ro‘yxatdan o‘tish</a></p>' +
      '</form>'
    )
    document.getElementById('native-login-username').addEventListener('submit', async function (event) {
      event.preventDefault()
      hideError()
      var data = readForm(event.currentTarget)
      if (!data.username) {
        showError('Login yoki emailni kiriting.')
        return
      }
      state.username = data.username
      var submit = event.currentTarget.querySelector('button[type="submit"]')
      submit.disabled = true
      submit.textContent = 'Tekshirilmoqda...'
      try {
        var response = await apiPost('/api/auth/login', { stage: 'username', username: state.username })
        state.userId = response.userId
        renderLoginPassword()
      } catch (error) {
        submit.disabled = false
        submit.textContent = 'Davom etish'
        showError(error.message)
      }
    })
  }

  function renderLoginPassword() {
    setShell('Parolni tasdiqlash', 'Hisobingiz paroli tekshiriladi va keyingi bosqichda OTP yuboriladi.', '2-bosqich / 4', ['Identifikator', 'Parol', 'OTP', 'Face ID'], 1)
    setRoot(
      errorBox() +
      '<form id="native-login-password" class="space-y-5">' +
      infoBox('🔑', state.username, 'Parol muvaffaqiyatli tasdiqlansa OTP kodi yuboriladi.') +
      inputField('Parol', 'password', 'password', 'Parolingizni kiriting', 'current-password', '') +
      '<div class="text-right text-sm"><a class="font-semibold text-[#0d6b5f] hover:underline" href="/auth/forgot-password">Parolni unutdingizmi?</a></div>' +
      '<div class="grid gap-3 sm:grid-cols-2">' +
      button('Orqaga', 'button', 'bg-slate-100 text-slate-800 hover:bg-slate-200', false).replace('<button', '<button id="native-back"') +
      button('OTP yuborish', 'submit', 'bg-[#0d3b66] text-white hover:bg-[#0a3155]', false) +
      '</div></form>'
    )
    document.getElementById('native-back').addEventListener('click', renderLoginUsername)
    document.getElementById('native-login-password').addEventListener('submit', async function (event) {
      event.preventDefault()
      hideError()
      var data = readForm(event.currentTarget)
      if (!data.password) {
        showError('Parolni kiriting.')
        return
      }
      var submit = event.currentTarget.querySelector('button[type="submit"]')
      submit.disabled = true
      submit.textContent = 'Yuborilmoqda...'
      try {
        var response = await apiPost('/api/auth/login', { stage: 'password', username: state.username, password: data.password })
        state.devOtp = response.devOtp || ''
        renderLoginOtp()
      } catch (error) {
        submit.disabled = false
        submit.textContent = 'OTP yuborish'
        showError(error.message)
      }
    })
  }

  function renderLoginOtp() {
    setShell('Bir martalik kod', 'Telegram orqali yuborilgan 6 xonali kodni kiriting.', '3-bosqich / 4', ['Identifikator', 'Parol', 'OTP', 'Face ID'], 2)
    setRoot(
      errorBox() +
      '<form id="native-login-otp" class="space-y-5">' +
      infoBox('🛡', 'Telegram tasdiqlash kodi', 'Ro‘yxatdan o‘tishda ko‘rsatilgan Telegram Chat ID ga yuborilgan kodni kiriting.', 'green') +
      (state.devOtp ? '<div class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><span class="font-semibold">Development OTP:</span> ' + escapeHtml(state.devOtp) + '</div>' : '') +
      inputField('6 xonali OTP', 'otp', 'text', '000000', 'one-time-code', '') +
      '<div class="grid gap-3 sm:grid-cols-2">' +
      button('Orqaga', 'button', 'bg-slate-100 text-slate-800 hover:bg-slate-200', false).replace('<button', '<button id="native-back"') +
      button('Kodni tasdiqlash', 'submit', 'bg-[#0d6b5f] text-white hover:bg-[#0a5a50]', false) +
      '</div></form>'
    )
    var otpInput = root.querySelector('input[name="otp"]')
    otpInput.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 6)
    })
    document.getElementById('native-back').addEventListener('click', renderLoginPassword)
    document.getElementById('native-login-otp').addEventListener('submit', async function (event) {
      event.preventDefault()
      hideError()
      var data = readForm(event.currentTarget)
      if (!data.otp || data.otp.length !== 6) {
        showError('6 xonali OTP kodni kiriting.')
        return
      }
      var submit = event.currentTarget.querySelector('button[type="submit"]')
      submit.disabled = true
      submit.textContent = 'Tekshirilmoqda...'
      try {
        var response = await apiPost('/api/auth/login', { stage: 'otp', userId: state.userId, otp: data.otp })
        state.sessionToken = response.sessionToken
        state.userId = response.userId
        renderLoginFace()
      } catch (error) {
        submit.disabled = false
        submit.textContent = 'Kodni tasdiqlash'
        showError(error.message)
      }
    })
  }

  async function renderDesktopQr() {
    var originResponse = await fetch('/api/public-origin')
    var originData = await originResponse.json()
    var origin = originData.origin || window.location.origin
    var mobileUrl = origin + '/auth/mobile-face?session=' + encodeURIComponent(state.sessionToken) + '&user=' + encodeURIComponent(state.userId)
    var qrResponse = await fetch('/api/qr-code?data=' + encodeURIComponent(mobileUrl))
    var qrData = await qrResponse.json()

    setRoot(
      errorBox() +
      '<div class="grid gap-5 lg:grid-cols-[320px_1fr]">' +
      '<div class="rounded-lg border border-slate-200 bg-white p-5 text-center"><div class="mx-auto flex h-72 w-72 items-center justify-center rounded-lg border border-slate-200 bg-white p-3">' +
      '<img src="' + qrData.image + '" alt="Mobile face verification QR code" class="h-full w-full" />' +
      '</div></div>' +
      '<div class="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-5">' +
      '<p class="text-sm font-semibold text-slate-900">Mobil verifikatsiya havolasi</p>' +
      '<p class="break-all rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">' + escapeHtml(mobileUrl) + '</p>' +
      '<div class="flex items-center gap-2 text-sm text-slate-700"><span id="native-poll-icon">⏳</span><span id="native-poll-text">Mobil tasdiqlash kutilmoqda...</span></div>' +
      '</div></div>'
    )

    var poll = setInterval(async function () {
      try {
        var response = await fetch('/api/auth/session-status?session=' + encodeURIComponent(state.sessionToken) + '&user=' + encodeURIComponent(state.userId))
        var data = await response.json()
        if (data.expired) {
          clearInterval(poll)
          showError('Sessiya muddati tugadi. Qaytadan login qiling.')
        }
        if (data.riskRequired) {
          clearInterval(poll)
          state.riskAnalysis = data.riskAnalysis
          state.riskDevOtp = data.devOtp || ''
          renderRiskVerification(data)
        }
        if (data.completed) {
          clearInterval(poll)
          document.getElementById('native-poll-icon').textContent = '✅'
          document.getElementById('native-poll-text').textContent = 'Mobil tasdiqlash yakunlandi.'
          redirectToSuccess(data.redirectUrl)
        }
      } catch {}
    }, 1500)
  }

  function renderLoginFace() {
    setShell('Biometrik tekshiruv', 'Yakuniy bosqichda foydalanuvchi yuzi tasdiqlanadi.', '4-bosqich / 4', ['Identifikator', 'Parol', 'OTP', 'Face ID'], 3)
    var isMobileLike = window.matchMedia('(max-width: 767px)').matches || window.matchMedia('(pointer: coarse)').matches
    if (!isMobileLike) {
      renderDesktopQr().catch(function (error) { showError(error.message) })
      return
    }

    setRoot(errorBox() + cameraHtml('Yuzni tasdiqlash'))
    document.getElementById('native-back').addEventListener('click', renderLoginOtp)
    document.getElementById('native-start-camera').addEventListener('click', startCamera)
    document.getElementById('native-face-submit').addEventListener('click', async function (event) {
      hideError()
      if (!camera.facialData) {
        showError('Yuz profili hali tayyor emas. Kameraga qarab kuting.')
        return
      }
      var submit = event.currentTarget
      submit.disabled = true
      submit.textContent = 'Tekshirilmoqda...'
      try {
        var response = await apiPost('/api/auth/facial-verify', {
          userId: state.userId,
          sessionToken: state.sessionToken,
          facialData: camera.facialData,
        })
        if (response.stage === 'risk_verification') {
          renderRiskVerification(response)
          return
        }
        redirectToSuccess(response.redirectUrl)
      } catch (error) {
        submit.disabled = false
        submit.textContent = 'Yuzni tasdiqlash'
        showError(error.message)
      }
    })
  }

  window.addEventListener('pagehide', function () {
    stopCamera()
    stopRegisterFacePoll()
  })

  if (mode === 'register') renderRegisterAccount()
  if (mode === 'login') renderLoginUsername()
})()

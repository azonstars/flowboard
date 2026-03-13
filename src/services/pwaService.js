// PWA Push Notification Service

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  return result
}

export const showNotification = (title, options = {}) => {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  const defaultOptions = {
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    ...options,
  }
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, defaultOptions)
    })
  } else {
    new Notification(title, defaultOptions)
  }
}

export const notifyNewSubmission = (branchName) =>
  showNotification('📋 নতুন Submission', {
    body: `${branchName} নতুন form submit করেছে`,
    tag: 'new-submission',
  })

export const notifyApproved = (formTitle) =>
  showNotification('✅ Approved!', {
    body: `"${formTitle}" approve হয়েছে`,
    tag: 'approved',
  })

export const notifyRejected = (formTitle, reason) =>
  showNotification('❌ Rejected', {
    body: `"${formTitle}" reject হয়েছে${reason ? ': ' + reason : ''}`,
    tag: 'rejected',
  })

export const notifyPendingApproval = (count) =>
  showNotification('⏳ Pending Approval', {
    body: `${count}টি submission approval-এর অপেক্ষায়`,
    tag: 'pending',
  })

let deferredInstallPrompt = null

export const initPWAInstallPrompt = () => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredInstallPrompt = e
  })
}

export const canInstallPWA = () => !!deferredInstallPrompt

export const installPWA = async () => {
  if (!deferredInstallPrompt) return false
  deferredInstallPrompt.prompt()
  const { outcome } = await deferredInstallPrompt.userChoice
  deferredInstallPrompt = null
  return outcome === 'accepted'
}

export const isInstalledPWA = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true

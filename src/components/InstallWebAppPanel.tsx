import { useEffect, useState } from 'react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isStandalone(): boolean {
  const iosNavigator = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || iosNavigator.standalone === true
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function InstallWebAppPanel() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => isStandalone())
  const [dismissed, setDismissed] = useState(false)
  const ios = isIos()

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as InstallPromptEvent)
    }
    const handleInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
    }

    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const install = async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    setPromptEvent(null)
    setDismissed(choice.outcome === 'dismissed')
  }

  const guidance = installed
    ? 'City Hub is installed. Open it from your home screen or app launcher.'
    : ios
      ? 'On iPhone or iPad: open in Safari, tap Share, then Add to Home Screen.'
      : promptEvent
        ? 'Install the same live city system as a full-screen app. No app store or account required.'
        : 'On Android or desktop: open the browser menu and choose Install app or Add to Home screen.'

  return (
    <section className="webapp-panel" aria-labelledby="webapp-title">
      <img className="webapp-icon" src="/brand/city-hub-app.png" alt="" />
      <div className="webapp-copy">
        <div className="webapp-kicker">AVAILABLE AS A WEB APP</div>
        <h2 id="webapp-title" className="webapp-title">Android + iPhone</h2>
        <p className="webapp-guidance">{guidance}</p>
        {dismissed && <p className="webapp-status" role="status">Install dismissed. You can try again from the browser menu.</p>}
      </div>
      {promptEvent && !installed ? (
        <button type="button" className="webapp-install" onClick={install}>INSTALL WEB APP</button>
      ) : (
        <img className="webapp-mono" src="/brand/city-hub-mono.png" alt="" aria-hidden />
      )}
    </section>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type TrackingState = 'idle' | 'starting-camera' | 'camera-ready' | 'tracking' | 'error'

type CameraState = {
  granted: boolean
  width: number
  height: number
  error?: string
}

function App() {
  const [trackingState, setTrackingState] = useState<TrackingState>('idle')
  const [camera, setCamera] = useState<CameraState>({
    granted: false,
    width: 0,
    height: 0,
  })
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const startCamera = async () => {
    try {
      setTrackingState('starting-camera')

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = stream

      const video = videoRef.current
      if (!video) {
        throw new Error('Video element not ready')
      }

      video.srcObject = stream
      await video.play()

      setCamera({
        granted: true,
        width: video.videoWidth,
        height: video.videoHeight,
      })
      setTrackingState('camera-ready')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown camera error'
      setCamera({ granted: false, width: 0, height: 0, error: message })
      setTrackingState('error')
    }
  }

  const enableTrackingDemo = () => {
    if (!camera.granted) return
    setTrackingState('tracking')
  }

  const status = useMemo(() => {
    switch (trackingState) {
      case 'idle':
        return {
          label: 'Ожидает запуск',
          tone: 'idle',
          hint: 'Нажми «Включить камеру», чтобы оживить прототип.',
        }
      case 'starting-camera':
        return {
          label: 'Запрашиваем камеру',
          tone: 'ready',
          hint: 'Подтверди доступ к камере на телефоне.',
        }
      case 'camera-ready':
        return {
          label: 'Камера готова',
          tone: 'ready',
          hint: 'Следом подключаем hand tracking и overlay.',
        }
      case 'tracking':
        return {
          label: 'Tracking demo активен',
          tone: 'live',
          hint: 'Следующий шаг — реальные landmarks и slash detection.',
        }
      case 'error':
        return {
          label: 'Ошибка камеры',
          tone: 'error',
          hint: camera.error ?? 'Не удалось получить видеопоток.',
        }
    }
  }, [trackingState, camera.error])

  return (
    <main className="shell">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">VisionPlay / Prototype</span>
          <h1>Игры жестами. Phone-first.</h1>
          <p className="lead">
            Уже есть живой camera flow. Следующий ход — hand tracking, landmarks,
            slash trail и первая игровая механика.
          </p>

          <div className="cta-row">
            <button className="primary" onClick={startCamera}>
              Включить камеру
            </button>
            <button
              className="secondary"
              onClick={enableTrackingDemo}
              disabled={!camera.granted}
            >
              Включить tracking demo
            </button>
          </div>

          <ul className="feature-list">
            <li>Phone-first gameplay</li>
            <li>Live camera preview</li>
            <li>On-device vision pipeline</li>
          </ul>
        </div>

        <div className="phone-stage">
          <div className="phone-frame">
            <div className="camera-status">
              <span className={`dot ${status.tone}`}></span>
              <div>
                <strong>{status.label}</strong>
                <p>{status.hint}</p>
              </div>
            </div>

            <div className="camera-view">
              <video ref={videoRef} className="camera-feed" autoPlay playsInline muted />
              <div className="video-shade"></div>
              <div className="grid"></div>
              <div className={`hand-marker ${trackingState}`}></div>
              <div className="hud top-left">FPS target: 30+</div>
              <div className="hud top-right">Mode: slash demo</div>
              <div className="hud bottom-left">
                {camera.granted
                  ? `${camera.width || '—'} × ${camera.height || '—'}`
                  : 'Camera offline'}
              </div>
              <div className="hud bottom-right">
                {trackingState === 'tracking' ? 'Tracking preview on' : 'Cast optional'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="info-grid">
        <article className="panel">
          <h2>Что уже есть</h2>
          <ul>
            <li>React + TypeScript scaffold</li>
            <li>Mobile-first prototype shell</li>
            <li>Live camera permission flow</li>
            <li>Структура под hand-tracking integration</li>
          </ul>
        </article>

        <article className="panel">
          <h2>Следующий билд</h2>
          <ul>
            <li>MediaPipe Hand Landmarker</li>
            <li>Overlay landmarks / tracked point</li>
            <li>Motion smoothing</li>
            <li>Slash detection + targets</li>
          </ul>
        </article>
      </section>
    </main>
  )
}

export default App

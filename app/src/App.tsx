import { useEffect, useMemo, useRef, useState } from 'react'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import './App.css'
import { getHandLandmarker, getPrimaryPoint } from './lib/handTracking'

type TrackingState =
  | 'idle'
  | 'starting-camera'
  | 'camera-ready'
  | 'loading-model'
  | 'tracking'
  | 'error'

type CameraState = {
  granted: boolean
  width: number
  height: number
  error?: string
}

type MarkerPoint = {
  x: number
  y: number
}

function App() {
  const [trackingState, setTrackingState] = useState<TrackingState>('idle')
  const [camera, setCamera] = useState<CameraState>({
    granted: false,
    width: 0,
    height: 0,
  })
  const [markerPoint, setMarkerPoint] = useState<MarkerPoint>({ x: 38, y: 62 })
  const [trackingMeta, setTrackingMeta] = useState({
    handsDetected: 0,
    fpsHint: '—',
    modelReady: false,
  })

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  const lastVideoTimeRef = useRef(-1)

  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const drawLandmarks = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    result: HandLandmarkerResult,
  ) => {
    ctx.clearRect(0, 0, width, height)

    const landmarks = result.landmarks[0]
    if (!landmarks?.length) return

    ctx.strokeStyle = 'rgba(85, 216, 255, 0.95)'
    ctx.fillStyle = 'rgba(85, 216, 255, 0.95)'
    ctx.lineWidth = 2

    landmarks.forEach((point, index) => {
      const x = width - point.x * width
      const y = point.y * height

      ctx.beginPath()
      ctx.arc(x, y, index === 8 ? 8 : 4, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  const startTracking = async () => {
    try {
      const video = videoRef.current
      const canvas = canvasRef.current

      if (!video || !canvas) {
        throw new Error('Tracking surface not ready')
      }

      setTrackingState('loading-model')
      const handLandmarker = await getHandLandmarker()
      setTrackingMeta((prev) => ({ ...prev, modelReady: true }))
      setTrackingState('tracking')

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('Canvas context unavailable')
      }

      const render = () => {
        if (video.readyState >= 2) {
          const width = video.videoWidth || 720
          const height = video.videoHeight || 1280

          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
          }

          if (video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime

            const result = handLandmarker.detectForVideo(video, performance.now())
            drawLandmarks(ctx, width, height, result)

            const primaryPoint = getPrimaryPoint(result)
            setTrackingMeta({
              handsDetected: result.handednesses.length,
              fpsHint: 'live',
              modelReady: true,
            })

            if (primaryPoint) {
              setMarkerPoint({
                x: (1 - primaryPoint.x) * 100,
                y: primaryPoint.y * 100,
              })
            }
          }
        }

        animationRef.current = requestAnimationFrame(render)
      }

      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
      render()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tracking startup error'
      setCamera((prev) => ({ ...prev, error: message }))
      setTrackingState('error')
    }
  }

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
          hint: 'Теперь можно запускать hand tracking.',
        }
      case 'loading-model':
        return {
          label: 'Грузим vision model',
          tone: 'ready',
          hint: 'MediaPipe инициализируется локально в браузере.',
        }
      case 'tracking':
        return {
          label: 'Tracking активен',
          tone: 'live',
          hint: 'Вижу руку — дальше добавим slash trail и hit detection.',
        }
      case 'error':
        return {
          label: 'Ошибка',
          tone: 'error',
          hint: camera.error ?? 'Не удалось поднять tracking.',
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
            Теперь тут уже не просто camera preview — подключаем live hand tracking
            на устройстве через MediaPipe.
          </p>

          <div className="cta-row">
            <button className="primary" onClick={startCamera}>
              Включить камеру
            </button>
            <button
              className="secondary"
              onClick={startTracking}
              disabled={!camera.granted}
            >
              Запустить hand tracking
            </button>
          </div>

          <ul className="feature-list">
            <li>Phone-first gameplay</li>
            <li>Live camera preview</li>
            <li>On-device MediaPipe tracking</li>
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
              <canvas ref={canvasRef} className="tracking-canvas" />
              <div className="video-shade"></div>
              <div className="grid"></div>
              <div
                className={`hand-marker ${trackingState}`}
                style={{ left: `${markerPoint.x}%`, top: `${markerPoint.y}%` }}
              ></div>
              <div className="hud top-left">
                Hands: {trackingMeta.handsDetected || 0}
              </div>
              <div className="hud top-right">
                Model: {trackingMeta.modelReady ? 'ready' : 'offline'}
              </div>
              <div className="hud bottom-left">
                {camera.granted
                  ? `${camera.width || '—'} × ${camera.height || '—'}`
                  : 'Camera offline'}
              </div>
              <div className="hud bottom-right">
                {trackingState === 'tracking'
                  ? `Tracking ${trackingMeta.fpsHint}`
                  : 'Cast optional'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="info-grid">
        <article className="panel">
          <h2>Что уже есть</h2>
          <ul>
            <li>Live camera permission flow</li>
            <li>MediaPipe loader</li>
            <li>Canvas overlay for landmarks</li>
            <li>Tracked point from index finger tip</li>
          </ul>
        </article>

        <article className="panel">
          <h2>Следующий билд</h2>
          <ul>
            <li>Motion smoothing</li>
            <li>Slash trail</li>
            <li>Velocity-based hit logic</li>
            <li>Spawnable targets</li>
          </ul>
        </article>
      </section>
    </main>
  )
}

export default App

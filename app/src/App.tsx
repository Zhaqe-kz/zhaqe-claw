import { useEffect, useMemo, useRef, useState } from 'react'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import './App.css'
import { clampTrail, estimateSwipe, type TrailPoint } from './lib/gesture'
import { getHandLandmarker, getPrimaryPoint } from './lib/handTracking'
import { countHits, createTargets, detectHits, type Target } from './lib/targets'

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
  const [targets, setTargets] = useState<Target[]>([])
  const [trackingMeta, setTrackingMeta] = useState({
    handsDetected: 0,
    fpsHint: '—',
    modelReady: false,
    slashReady: false,
    swipeSpeed: 0,
    score: 0,
  })

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  const lastVideoTimeRef = useRef(-1)
  const trailRef = useRef<TrailPoint[]>([])

  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const drawScene = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    result: HandLandmarkerResult,
    trail: TrailPoint[],
    sceneTargets: Target[],
  ) => {
    ctx.clearRect(0, 0, width, height)

    sceneTargets.forEach((target) => {
      ctx.beginPath()
      ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2)
      ctx.fillStyle = target.hit ? 'rgba(56, 239, 125, 0.38)' : 'rgba(255, 180, 70, 0.28)'
      ctx.fill()
      ctx.lineWidth = 3
      ctx.strokeStyle = target.hit ? 'rgba(56, 239, 125, 0.95)' : 'rgba(255, 196, 107, 0.95)'
      ctx.stroke()
    })

    if (trail.length > 1) {
      ctx.beginPath()
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.strokeStyle = 'rgba(0, 214, 255, 0.75)'
      trail.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y)
        } else {
          ctx.lineTo(point.x, point.y)
        }
      })
      ctx.stroke()
    }

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

  const resetTargets = () => {
    const video = videoRef.current
    const width = video?.videoWidth || 720
    const height = video?.videoHeight || 1280
    const nextTargets = createTargets(width, height)
    setTargets(nextTargets)
    setTrackingMeta((prev) => ({ ...prev, score: 0 }))
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

          if (targets.length === 0) {
            setTargets(createTargets(width, height))
          }

          if (video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime

            const result = handLandmarker.detectForVideo(video, performance.now())
            const primaryPoint = getPrimaryPoint(result)
            let slashReady = false
            let swipeSpeed = 0
            let nextTargets = targets

            if (primaryPoint) {
              const mappedX = (1 - primaryPoint.x) * width
              const mappedY = primaryPoint.y * height
              trailRef.current = clampTrail(
                [...trailRef.current, { x: mappedX, y: mappedY, t: performance.now() }],
                10,
              )

              const swipe = estimateSwipe(trailRef.current)
              slashReady = swipe.isSlash
              swipeSpeed = Math.round(swipe.speed)

              nextTargets = detectHits(targets, trailRef.current, slashReady)
              const score = countHits(nextTargets)
              if (score !== countHits(targets)) {
                setTargets(nextTargets)
              }

              setMarkerPoint({
                x: (1 - primaryPoint.x) * 100,
                y: primaryPoint.y * 100,
              })

              setTrackingMeta({
                handsDetected: result.handednesses.length,
                fpsHint: 'live',
                modelReady: true,
                slashReady,
                swipeSpeed,
                score,
              })
            } else {
              trailRef.current = []
              setTrackingMeta((prev) => ({
                ...prev,
                handsDetected: 0,
                slashReady: false,
                swipeSpeed: 0,
              }))
            }

            drawScene(ctx, width, height, result, trailRef.current, nextTargets)
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
      setTargets(createTargets(video.videoWidth || 720, video.videoHeight || 1280))
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
        return trackingMeta.slashReady
          ? {
              label: 'Slash detected',
              tone: 'live',
              hint: 'Уже можно поражать цели траекторией руки.',
            }
          : {
              label: 'Tracking активен',
              tone: 'live',
              hint: 'Вижу руку — двигайся быстрее, чтобы рубить цели.',
            }
      case 'error':
        return {
          label: 'Ошибка',
          tone: 'error',
          hint: camera.error ?? 'Не удалось поднять tracking.',
        }
    }
  }, [trackingState, camera.error, trackingMeta.slashReady])

  return (
    <main className="shell">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">VisionPlay / Prototype</span>
          <h1>Игры жестами. Phone-first.</h1>
          <p className="lead">
            Уже есть первый playable loop: рука, trail, slash signal и цели,
            которые можно сбивать движением руки.
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
            <button className="secondary" onClick={resetTargets} disabled={!camera.granted}>
              Сбросить цели
            </button>
          </div>

          <ul className="feature-list">
            <li>Phone-first gameplay</li>
            <li>Trail + slash signal detection</li>
            <li>Targets + score loop</li>
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

            <div className={`camera-view ${trackingMeta.slashReady ? 'slash-active' : ''}`}>
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
                Score: {trackingMeta.score}/{targets.length}
              </div>
              <div className="hud bottom-left">
                Speed: {trackingMeta.swipeSpeed}px/s
              </div>
              <div className="hud bottom-right">
                {trackingState === 'tracking'
                  ? `Slash ${trackingMeta.slashReady ? 'ready' : 'waiting'}`
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
            <li>MediaPipe hand tracking</li>
            <li>Canvas overlay + trail</li>
            <li>Targets, hits and score</li>
          </ul>
        </article>

        <article className="panel">
          <h2>Следующий билд</h2>
          <ul>
            <li>Сглаживание и debounce slash</li>
            <li>Анимация появления целей</li>
            <li>Feedback effects on hit</li>
            <li>Полный Fruit Ninja-like loop</li>
          </ul>
        </article>
      </section>
    </main>
  )
}

export default App

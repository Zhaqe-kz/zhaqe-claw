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

type CameraFacing = 'user' | 'environment'

function App() {
  const [trackingState, setTrackingState] = useState<TrackingState>('idle')
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('environment')
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
    lastHitAt: 0,
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
      ctx.fillStyle = target.hit ? 'rgba(56, 239, 125, 0.5)' : 'rgba(255, 180, 70, 0.34)'
      ctx.fill()
      ctx.lineWidth = 4
      ctx.strokeStyle = target.hit ? 'rgba(56, 239, 125, 1)' : 'rgba(255, 210, 107, 1)'
      ctx.stroke()

      if (target.hit && target.hitAt) {
        ctx.fillStyle = 'rgba(255,255,255,0.95)'
        ctx.font = 'bold 28px Inter, sans-serif'
        ctx.fillText('+1', target.x - 12, target.y - target.radius - 10)
      }
    })

    if (trail.length > 1) {
      ctx.beginPath()
      ctx.lineWidth = 8
      ctx.lineCap = 'round'
      ctx.strokeStyle = 'rgba(0, 214, 255, 0.85)'
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
      ctx.arc(x, y, index === 8 ? 9 : 4, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  const resetTargets = () => {
    const video = videoRef.current
    const width = video?.videoWidth || 720
    const height = video?.videoHeight || 1280
    const nextTargets = createTargets(width, height)
    setTargets(nextTargets)
    setTrackingMeta((prev) => ({ ...prev, score: 0, lastHitAt: 0 }))
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
                12,
              )

              const swipe = estimateSwipe(trailRef.current)
              slashReady = swipe.isSlash
              swipeSpeed = Math.round(swipe.speed)

              nextTargets = detectHits(targets, trailRef.current, slashReady)
              const score = countHits(nextTargets)
              const previousScore = countHits(targets)
              const didHit = score !== previousScore

              if (didHit) {
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
                lastHitAt: didHit ? Date.now() : trackingMeta.lastHitAt,
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

  const startCamera = async (facing = cameraFacing) => {
    try {
      const mediaDevices = navigator.mediaDevices
      if (!mediaDevices?.getUserMedia) {
        throw new Error(
          'Камера недоступна в этом браузере/контексте. Открой в Safari/Chrome и лучше через HTTPS или localhost.',
        )
      }

      setTrackingState('starting-camera')

      const stream = await mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
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

  const toggleCameraFacing = async () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user'
    setCameraFacing(nextFacing)
    await startCamera(nextFacing)
  }

  const status = useMemo(() => {
    switch (trackingState) {
      case 'idle':
        return {
          label: 'Ожидает запуск',
          tone: 'idle',
          hint: 'Нажми «Включить камеру», затем быстро проведи рукой через цель.',
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
          hint: 'Теперь запусти tracking и руби цели быстрым движением.',
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
              label: 'РУБИ СЕЙЧАС',
              tone: 'live',
              hint: 'Быстрый взмах рукой через цель даёт попадание.',
            }
          : {
              label: 'Tracking активен',
              tone: 'live',
              hint: 'Сделай более быстрый взмах рукой через кружок.',
            }
      case 'error':
        return {
          label: 'Ошибка',
          tone: 'error',
          hint: camera.error ?? 'Не удалось поднять tracking.',
        }
    }
  }, [trackingState, camera.error, trackingMeta.slashReady])

  const hitGlowActive = Date.now() - trackingMeta.lastHitAt < 220

  return (
    <main className="shell">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">VisionPlay / Prototype</span>
          <h1>Игры жестами. Phone-first.</h1>
          <p className="lead">
            Теперь удар делать проще: задняя камера, более щедрый hitbox и более
            понятный feedback на попадание.
          </p>

          <div className="cta-row">
            <button className="primary" onClick={() => startCamera()}>
              Включить камеру
            </button>
            <button
              className="secondary"
              onClick={startTracking}
              disabled={!camera.granted}
            >
              Запустить hand tracking
            </button>
            <button className="secondary" onClick={toggleCameraFacing}>
              Камера: {cameraFacing === 'environment' ? 'задняя' : 'передняя'}
            </button>
            <button className="secondary" onClick={resetTargets} disabled={!camera.granted}>
              Сбросить цели
            </button>
          </div>

          <ul className="feature-list">
            <li>По умолчанию старт с задней камеры</li>
            <li>Быстрый взмах рукой через цель = hit</li>
            <li>Больше hitbox и лучше feedback</li>
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

            <div
              className={`camera-view ${trackingMeta.slashReady ? 'slash-active' : ''} ${hitGlowActive ? 'hit-glow' : ''}`}
            >
              <video ref={videoRef} className={`camera-feed ${cameraFacing === 'user' ? 'mirrored' : ''}`} autoPlay playsInline muted />
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
                  ? `Slash ${trackingMeta.slashReady ? 'GO' : 'wait'}`
                  : cameraFacing === 'environment'
                    ? 'Back cam'
                    : 'Front cam'}
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
          <h2>Как играть сейчас</h2>
          <ul>
            <li>Включи камеру</li>
            <li>Запусти hand tracking</li>
            <li>Наведи руку в кадр</li>
            <li>Быстро проведи рукой через цель</li>
          </ul>
        </article>
      </section>
    </main>
  )
}

export default App

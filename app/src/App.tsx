import { useEffect, useMemo, useRef, useState } from 'react'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import './App.css'
import { clampTrail, estimateSwipe, type TrailPoint } from './lib/gesture'
import { getHandLandmarker, getPrimaryPoint } from './lib/handTracking'
import { createTargets, detectHits, respawnTarget, type Target } from './lib/targets'

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
      const fade = target.hit && target.hitAt ? Math.max(0, 1 - (Date.now() - target.hitAt) / 380) : 1
      ctx.globalAlpha = fade
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
      ctx.globalAlpha = 1
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
    setTargets(createTargets(width, height))
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

              const hitScannedTargets = detectHits(targets, trailRef.current, slashReady)
              const previousHits = targets.filter((target) => target.hit).length
              const nextHits = hitScannedTargets.filter((target) => target.hit).length
              const didHit = nextHits > previousHits

              nextTargets = hitScannedTargets.map((target) => {
                if (target.hit && target.hitAt && Date.now() - target.hitAt > 420) {
                  return respawnTarget(target, width, height)
                }
                return target
              })

              if (didHit || nextTargets !== targets) {
                setTargets(nextTargets)
              }

              setMarkerPoint({
                x: (1 - primaryPoint.x) * 100,
                y: primaryPoint.y * 100,
              })

              setTrackingMeta((prev) => ({
                handsDetected: result.handednesses.length,
                fpsHint: 'live',
                modelReady: true,
                slashReady,
                swipeSpeed,
                score: didHit ? prev.score + 1 : prev.score,
                lastHitAt: didHit ? Date.now() : prev.lastHitAt,
              }))
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
      setTrackingMeta((prev) => ({ ...prev, score: 0 }))
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
              hint: 'После попадания цель исчезает и затем появляется в новом месте.',
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
    <main className="app-shell">
      <section className="game-stage">
        <div className="game-topbar">
          <div className="brand-block">
            <span className="eyebrow">VisionPlay / Slash Mode</span>
            <h1>Режь цели рукой</h1>
            <p>{status.hint}</p>
          </div>

          <div className="controls-block">
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
        </div>

        <div className="game-layout">
          <div className="game-canvas-wrap">
            <div
              className={`game-canvas ${trackingMeta.slashReady ? 'slash-active' : ''} ${hitGlowActive ? 'hit-glow' : ''}`}
            >
              <video
                ref={videoRef}
                className={`camera-feed ${cameraFacing === 'user' ? 'mirrored' : ''}`}
                autoPlay
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="tracking-canvas" />
              <div className="video-shade"></div>
              <div className="grid"></div>
              <div
                className={`hand-marker ${trackingState}`}
                style={{ left: `${markerPoint.x}%`, top: `${markerPoint.y}%` }}
              ></div>

              <div className="hud hud-score">Score: {trackingMeta.score}</div>
              <div className="hud hud-hands">Hands: {trackingMeta.handsDetected || 0}</div>
              <div className="hud hud-speed">Speed: {trackingMeta.swipeSpeed}px/s</div>
              <div className="hud hud-slash">
                {trackingState === 'tracking'
                  ? `Slash ${trackingMeta.slashReady ? 'GO' : 'wait'}`
                  : cameraFacing === 'environment'
                    ? 'Back cam'
                    : 'Front cam'}
              </div>
            </div>
          </div>

          <aside className="side-panel">
            <div className="status-card">
              <span className={`dot ${status.tone}`}></span>
              <div>
                <strong>{status.label}</strong>
                <p>{status.hint}</p>
              </div>
            </div>

            <div className="instruction-box compact">
              <strong>Как играть:</strong>
              <ol>
                <li>Включи камеру</li>
                <li>Запусти hand tracking</li>
                <li>Большой голубой круг — это твоя рука</li>
                <li>Маленькие оранжевые круги — цели</li>
                <li>Быстро проведи рукой через цель</li>
              </ol>
            </div>

            <div className="info-card">
              <h2>Что уже есть</h2>
              <ul>
                <li>MediaPipe hand tracking</li>
                <li>Canvas overlay + trail</li>
                <li>Event-based score</li>
                <li>Respawn targets</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}

export default App

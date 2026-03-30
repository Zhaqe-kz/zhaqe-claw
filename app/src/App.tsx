import { useMemo, useState } from 'react'
import './App.css'

type TrackingState = 'idle' | 'camera-ready' | 'tracking'

function App() {
  const [trackingState, setTrackingState] = useState<TrackingState>('idle')

  const status = useMemo(() => {
    switch (trackingState) {
      case 'idle':
        return {
          label: 'Ожидает запуск',
          tone: 'idle',
          hint: 'Разреши камеру и поставь руку в кадр.',
        }
      case 'camera-ready':
        return {
          label: 'Камера готова',
          tone: 'ready',
          hint: 'Следующий шаг — подключаем hand tracking.',
        }
      case 'tracking':
        return {
          label: 'Трекинг активен',
          tone: 'live',
          hint: 'Дальше сюда встанут gesture detection и slash logic.',
        }
    }
  }, [trackingState])

  return (
    <main className="shell">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">VisionPlay / Prototype</span>
          <h1>Игры жестами. Phone-first.</h1>
          <p className="lead">
            Первый прототип идёт от самого короткого пути: камера, локальный hand
            tracking, slash-механика и optional cast на TV.
          </p>

          <div className="cta-row">
            <button
              className="primary"
              onClick={() => setTrackingState('camera-ready')}
            >
              Включить камеру
            </button>
            <button
              className="secondary"
              onClick={() => setTrackingState('tracking')}
            >
              Demo: tracking on
            </button>
          </div>

          <ul className="feature-list">
            <li>Phone-first gameplay</li>
            <li>On-device vision</li>
            <li>Gesture slash prototype</li>
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
              <div className="grid"></div>
              <div className={`hand-marker ${trackingState}`}></div>
              <div className="hud top-left">FPS target: 30+</div>
              <div className="hud top-right">Mode: slash demo</div>
              <div className="hud bottom-left">Camera → Tracking → Gesture</div>
              <div className="hud bottom-right">Cast optional</div>
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
            <li>Состояния для камеры и tracking flow</li>
            <li>Готовая база под hand-tracking integration</li>
          </ul>
        </article>

        <article className="panel">
          <h2>Что будет следующим</h2>
          <ul>
            <li>Доступ к реальной камере</li>
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

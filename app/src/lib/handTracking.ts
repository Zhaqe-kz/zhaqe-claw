import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision'

let landmarkerPromise: Promise<HandLandmarker> | null = null

export async function getHandLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm',
      )

      return HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      })
    })()
  }

  return landmarkerPromise
}

export type NormalizedPoint = {
  x: number
  y: number
}

export function getPrimaryPoint(result: HandLandmarkerResult): NormalizedPoint | null {
  const firstHand = result.landmarks[0]
  if (!firstHand?.length) return null

  const indexTip = firstHand[8]
  return {
    x: indexTip.x,
    y: indexTip.y,
  }
}

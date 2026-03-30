# VisionPlay — Product & Technical Brief

## 1. Working title

**VisionPlay**

## 2. One-line pitch

A phone-first web gaming prototype where players control gameplay with hand gestures using their phone camera, and can optionally mirror the experience to a TV.

## 3. Product direction

### Initial mode
**Phone-first**

The first playable prototype runs directly on the phone. The phone handles:
- camera input
- hand tracking
- game rendering
- gesture-to-action mapping

The TV is optional in this phase and acts as a mirrored display via system-level casting/screen sharing.

### Why this mode first
This mode reduces product and engineering complexity by avoiding:
- QR pairing between two clients
- realtime state sync between phone and TV browser
- separate rendering and controller clients
- unnecessary early infrastructure

It allows the team to validate the most important hypothesis first:

> Is gesture-based gameplay via phone camera actually fun, responsive, and impressive enough to justify the product?

## 4. Problem

Casual motion-based play on large screens is still awkward or hardware-dependent.

Current options usually require one of the following:
- gamepads or remotes
- dedicated hardware such as Kinect-like devices
- mobile-only games without a strong shared-screen experience
- installations or setup-heavy onboarding

There is no simple, accessible way to let a user play a gesture-controlled game using only a phone they already have.

## 5. Solution

VisionPlay turns the phone into a **vision-based controller and game device**.

The user:
1. opens the game on their phone
2. grants camera access
3. positions the phone so the hand is visible
4. starts playing immediately with hand motion
5. optionally mirrors the screen to a TV for a larger shared experience

## 6. Core product hypothesis

If hand tracking can run locally on the phone with acceptable latency, then a phone can become a practical no-controller interface for casual games.

## 7. Technical hypothesis

Modern mobile devices are capable of running lightweight hand tracking locally in real time, allowing the system to:
- avoid streaming raw video to a server
- keep latency low
- reduce infrastructure cost
- preserve privacy better than cloud video processing

## 8. First playable experience

### Game concept
**Slash Demo / Fruit-Ninja-like Prototype**

### Interaction loop
- objects appear on screen
- player moves hand quickly through the air
- hand path is interpreted as a slash trajectory
- collisions award points

### Initial input model
To keep MVP scope tight, the first version should avoid complex gesture vocabularies.

Use only:
- tracked hand position
- velocity of movement
- slash event detection based on motion speed and direction

Avoid in V1:
- multi-hand tracking
- complex pose recognition
- menu navigation by many gesture types
- multiplayer

## 9. UX goals

The prototype should feel fast and magical.

### Success criteria
A new user should be able to:
1. open the experience
2. allow camera access
3. see that their hand is detected
4. perform one slash
5. understand the interaction within seconds

### Onboarding requirements
The prototype should guide the player with:
- camera permission prompt
- framing hint ("place your hand in view")
- tracking-ready indicator
- short start interaction

## 10. Architecture direction

### V1 architecture
**Single-client architecture**

#### On-device
- camera capture in mobile browser
- local hand tracking
- gesture calculation
- gameplay rendering

#### Optional external display
- system-level screen mirroring / casting

#### Server (optional for V1)
- static app hosting
- analytics/event logging later
- session backend only when multi-device mode is introduced

## 11. Suggested tech stack

### Frontend
- **Next.js** or **Vite + React**
- **TypeScript**
- **Canvas** or **PixiJS** for rendering

### Vision
- **MediaPipe Hand Landmarker** or equivalent browser-friendly hand tracking stack

### State / game loop
- lightweight local state management
- animation loop via requestAnimationFrame

### Backend
Not required for the first interaction prototype beyond simple hosting.

## 12. MVP scope

### In scope
- phone-first web app
- mobile camera access
- single-hand tracking
- visible hand cursor/trail
- slash detection
- simple target objects
- score counter
- basic onboarding UI

### Out of scope
- accounts
- payments
- multiplayer
- advanced gestures
- cloud CV processing
- separate TV web client
- content platform model

## 13. Main risks

### 1. Latency and FPS
Local inference and rendering may be too heavy on weaker devices.

### 2. Tracking quality
Performance may degrade due to:
- lighting
- background clutter
- camera angle
- hand visibility

### 3. Device setup friction
Users may struggle to position the phone correctly while seeing the screen comfortably.

### 4. Thermal/performance constraints
Long sessions may heat the phone or reduce FPS.

## 14. Risk mitigation

- start with one-hand tracking only
- use lightweight models/settings
- design forgiving hit detection
- add motion smoothing
- keep graphics simple in V1
- optimize for short demo sessions first

## 15. Product roadmap

### Phase 1 — Proof of interaction
- hand detection
- cursor/trail visualization
- slash event detection

### Phase 2 — Playable prototype
- spawnable objects
- scoring
- game loop
- onboarding

### Phase 3 — Demo polish
- better feedback
- visual effects
- casting guidance
- landing page/demo framing

### Phase 4 — Expansion paths
Potential next directions:
- dual-device mode with QR pairing
- party games
- fitness interactions
- multiplayer duels
- B2B branded experiences

## 16. Build objective for the first engineering sprint

Create a playable phone-first prototype that proves all of the following:
- hand tracking works in browser on phone
- slash input can be detected reliably enough for casual gameplay
- the experience is understandable and delightful within one short session

## 17. Definition of success

The prototype is successful if a user can say:

> "I opened it on my phone, let it see my hand, swung once, and it felt like I was controlling the game in the air."

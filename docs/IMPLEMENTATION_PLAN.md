# VisionPlay — Initial Implementation Plan

## Goal
Build a phone-first playable prototype with correct product framing and minimal architecture waste.

## Phase 0 — Foundation
- create repo structure
- define PRD and technical brief
- establish project conventions
- prepare prototype folders

## Phase 1 — Hand tracking proof
- mobile web page with camera access
- integrate browser-based hand tracking
- visualize tracked hand point(s)
- add debug overlay

## Phase 2 — Interaction mechanics
- compute motion velocity
- detect slash events
- draw hand trail
- tune smoothing/filtering

## Phase 3 — Game loop
- spawn targets
- collision detection against slash path
- score system
- restart loop

## Phase 4 — MVP UX
- onboarding screen
- camera permission UX
- calibration prompt
- tracking status indicator
- simple cast/mirror instructions

## Engineering principles
- optimize for demo speed, not framework perfection
- keep CV local on device
- avoid backend unless it clearly unlocks value
- keep game logic modular so dual-device mode can be added later

## Deliverable for first build cycle
A mobile-first web prototype that demonstrates:
- camera permission flow
- on-device hand tracking
- visible motion response
- at least one playable interaction

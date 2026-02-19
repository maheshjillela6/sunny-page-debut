# Slot Game Framework — Complete Technical Architecture Document

> **Version:** 2.0  
> **Last Updated:** 2026-02-19  
> **Audience:** Developers, architects, QA engineers, and anyone working on or extending this framework.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure Overview](#3-project-structure-overview)
4. [Architectural Layers](#4-architectural-layers)
5. [Bootstrap & Application Shell](#5-bootstrap--application-shell)
6. [Platform Layer — Infrastructure Services](#6-platform-layer--infrastructure-services)
   - 6.1 [EventBus — Deep Dive](#61-eventbus--deep-dive)
   - 6.2 [EventEnvelope — Metadata & Integrity](#62-eventenvelope--metadata--integrity)
   - 6.3 [EventHistory — Circular Buffer](#63-eventhistory--circular-buffer)
   - 6.4 [EventScheduler — Delayed & Repeating Events](#64-eventscheduler--delayed--repeating-events)
   - 6.5 [EventTimeline — Debug Recording](#65-eventtimeline--debug-recording)
   - 6.6 [EventTracker — Performance Monitoring](#66-eventtracker--performance-monitoring)
   - 6.7 [Networking — Adapter Pattern](#67-networking--adapter-pattern)
   - 6.8 [Audio Infrastructure](#68-audio-infrastructure)
   - 6.9 [Localization](#69-localization)
   - 6.10 [Logger](#610-logger)
7. [Engine Layer — The Brain](#7-engine-layer--the-brain)
   - 7.1 [EngineKernel — The Orchestrator](#71-enginekernel--the-orchestrator)
   - 7.2 [Game Initialization Sequence (Deep Dive)](#72-game-initialization-sequence-deep-dive)
   - 7.3 [EngineStateMachine — Guarded Transitions](#73-enginestatemachine--guarded-transitions)
   - 7.4 [GameLoader — 6-Phase Loading Pipeline](#74-gameloader--6-phase-loading-pipeline)
   - 7.5 [Flow System](#75-flow-system)
   - 7.6 [Plugin System](#76-plugin-system)
   - 7.7 [Audio Engine](#77-audio-engine)
   - 7.8 [Data Persistence](#78-data-persistence)
8. [Module System — Pluggable Game Mechanics](#8-module-system--pluggable-game-mechanics)
9. [Gameplay Layer — Game Logic & Orchestration](#9-gameplay-layer--game-logic--orchestration)
   - 9.1 [GameController — The Main Loop](#91-gamecontroller--the-main-loop)
   - 9.2 [State Management](#92-state-management)
   - 9.3 [Timeline System — Deep Dive](#93-timeline-system--deep-dive)
   - 9.4 [Timing & Turbo Mode](#94-timing--turbo-mode)
   - 9.5 [Replay System — Deep Dive](#95-replay-system--deep-dive)
10. [Runtime Layer — Pixi.js Rendering](#10-runtime-layer--pixijs-rendering)
    - 10.1 [PixiApplicationManager — Subsystem Coordinator](#101-pixiapplicationmanager--subsystem-coordinator)
    - 10.2 [PixiTicker — The Game Loop](#102-pixiticker--the-game-loop)
    - 10.3 [PixiClock — High-Precision Timing](#103-pixiclock--high-precision-timing)
    - 10.4 [Viewport & Resizing — Deep Dive](#104-viewport--resizing--deep-dive)
    - 10.5 [Object Pooling — Deep Dive](#105-object-pooling--deep-dive)
    - 10.6 [Asset Pipeline](#106-asset-pipeline)
    - 10.7 [Spine Animation](#107-spine-animation)
11. [Presentation Layer — Visual Components](#11-presentation-layer--visual-components)
    - 11.1 [Layer System — Deep Dive (Z-Ordering)](#111-layer-system--deep-dive-z-ordering)
    - 11.2 [StageRoot — The Display Tree](#112-stageroot--the-display-tree)
    - 11.3 [Individual Layers Explained](#113-individual-layers-explained)
    - 11.4 [Screen System](#114-screen-system)
    - 11.5 [Grid System](#115-grid-system)
    - 11.6 [Win Presentation](#116-win-presentation)
    - 11.7 [Cascade Presentation](#117-cascade-presentation)
    - 11.8 [Transition System](#118-transition-system)
12. [UI Layer — React Overlay](#12-ui-layer--react-overlay)
13. [Configuration System](#13-configuration-system)
14. [EventBus Communication Flows](#14-eventbus-communication-flows)
    - 14.1 [How Wiring Works](#141-how-wiring-works)
    - 14.2 [Event Categories](#142-event-categories)
    - 14.3 [Complete Spin Event Flow](#143-complete-spin-event-flow)
    - 14.4 [Priority-Based Dispatch](#144-priority-based-dispatch)
    - 14.5 [Event Queueing During Processing](#145-event-queueing-during-processing)
15. [Full Lifecycle Flow: Lobby → Game Launch → Spin → Win → Cleanup](#15-full-lifecycle-flow)
16. [Network Architecture](#16-network-architecture)
17. [Extending the Framework](#17-extending-the-framework)
18. [Design Decisions & Rationale](#18-design-decisions--rationale)
19. [Glossary](#19-glossary)
20. [Appendix A: Complete File Index](#20-appendix-a-complete-file-index)

---

## 1. Executive Summary

This is a **modular, config-driven slot game framework** built with TypeScript. It renders games using **Pixi.js** (WebGL) for the canvas and **React** for the UI overlay (HUD, controls, modals). All inter-module communication flows through a centralized **EventBus** using a typed pub/sub pattern, ensuring complete decoupling between layers.

**Key Characteristics:**
- **Config-driven:** Game behavior (grid size, symbols, win systems, features, spin mechanics) is defined in JSON files — no code changes needed per game.
- **Pluggable modules:** Spin strategies, win evaluators, and features are registered at runtime and selected by configuration.
- **Server-authoritative:** The client never evaluates wins — all outcomes come from the server (or mock server). The client is purely a presentation layer.
- **Event-driven architecture:** Components never call each other directly. They publish/subscribe to typed events on the EventBus.

---

## 2. Technology Stack

| Layer | Technology | Why We Chose It |
|-------|-----------|-----------------|
| **Language** | TypeScript | Type safety across 200+ files, IDE autocomplete, compile-time error catching |
| **Build Tool** | Vite | Sub-second HMR, ESM-native, tree-shaking for small bundles |
| **Game Rendering** | Pixi.js v8 | Industry-standard 2D WebGL renderer, 60fps GPU-accelerated, mature ecosystem |
| **Skeletal Animation** | Spine (pixi-spine) | Rich character/symbol animations exported from artist tools (Spine Editor) |
| **Animation Tweens** | GSAP | Battle-tested tweening library for canvas animations (easing, timelines, stagger) |
| **UI Framework** | React 18 | Component model for HUD/controls, accessibility via Radix primitives |
| **UI Animation** | Framer Motion | Declarative React animations for modals, transitions, micro-interactions |
| **Styling** | Tailwind CSS | Utility-first for rapid iteration on UI overlay |
| **UI Components** | shadcn/ui (Radix) | Accessible, composable, unstyled primitives |
| **Audio** | Howler.js | Cross-browser audio with sprite sheets, pooling, volume channels |
| **State** | Singleton services + EventBus | No Redux overhead; state accessible from both React and non-React code |
| **Routing** | React Router v6 | Lobby → Game navigation with session persistence across page refreshes |

---

## 3. Project Structure Overview

```
src/
├── bootstrap/           # App shell: entry point, routing, providers
├── platform/            # Infrastructure: EventBus, networking, audio, i18n, logging
│   ├── events/          #   EventBus, EventMap, EventEnvelope, EventScheduler, etc.
│   ├── networking/      #   NetworkManager, adapters (REST/STOMP/Mock), session
│   ├── audio/           #   AudioBus, SoundManager, AudioRegistry
│   ├── localization/    #   LocaleManager, language packs
│   └── logger/          #   Logger, transports, formatting
├── engine/              # Core engine: kernel, state machine, flow, plugins, audio
│   ├── core/            #   EngineKernel, EngineStateMachine, GameLoader
│   ├── flow/            #   FlowSystem, FlowTypes
│   ├── plugin/          #   SlotPlugin, PluginRegistry, dependency resolution
│   ├── audio/           #   AudioManager, AudioController, channels
│   ├── data/            #   DataStore, serialization, snapshots
│   └── namespace/       #   Engine namespace management
├── modules/             # Pluggable game modules
│   ├── mechanics/       #   Spin strategies: cascade, cluster, megaways, infinity, dualboard
│   ├── features/        #   FreeSpins, Wilds, Multipliers, Bonus, SpinMechanisms
│   ├── winsystems/      #   Paylines, Ways, Cluster, Megaways evaluators
│   └── registry/        #   ModuleRegistry, SpinStrategyRegistry
├── gameplay/            # Game logic: controller, state, models, timeline, replay
│   ├── engine/          #   GameController, PresentationOrchestrator, TickManager
│   ├── state/           #   GameSession, RoundState, WalletState, FeatureState
│   ├── timeline/        #   TimelineRunner, SequenceBuilder, actions (Parallel, Delay, Loop, Conditional)
│   ├── timing/          #   TimingProvider, TurboState
│   ├── replay/          #   ReplayRecorder, ReplayPlayer
│   ├── models/          #   GameModel, RoundModel, WalletModel
│   ├── evaluation/      #   Win evaluation helpers
│   └── actions/         #   Action definitions
├── runtime/             # Pixi.js runtime
│   └── pixi/
│       ├── core/        #   PixiApplicationManager, PixiRuntime, PixiTicker, PixiClock
│       ├── stage/       #   StageManager, StageRoot (layer hierarchy)
│       ├── viewport/    #   ViewportManager, AspectScaler, ResizeObserver, OrientationObserver, etc.
│       ├── containers/  #   BaseContainer, LayerContainer
│       ├── pooling/     #   ObjectPool, SymbolPool, SpinePool, FXPool
│       ├── assets/      #   AssetPreloader, TextureCache, SpritesheetLoader
│       ├── spine/       #   SpineAnimator, SpineFactory, SpineLoader
│       ├── factory/     #   PixiFactory (display object creation)
│       └── animation/   #   TweenFactory, presets, filter management (GSAP-based)
├── presentation/        # Visual components
│   ├── layers/          #   BackgroundLayer, ScreenLayer, TransitionLayer, OverlayLayer, etc.
│   ├── grid/            #   GridManager, GridContainer, reels, symbols, masks
│   ├── win/             #   WinCounter, LineHighlight, WaysHighlight, WinText
│   ├── cascade/         #   CascadePresenter, CascadePhaseHandler
│   ├── screens/         #   ScreenManager, ScreenBase, BaseScreen, ScreenLifecycle
│   ├── transitions/     #   FadeTransition, SlideTransition, PortalTransition, ZoomTransition
│   └── hud/             #   In-canvas HUD elements
├── ui/                  # React UI overlay
│   ├── controls/        #   Spin button, autoplay, turbo
│   ├── hud/             #   Balance, bet, win display
│   ├── lobby/           #   Game selection grid
│   ├── modals/          #   Paytable, settings, rules
│   ├── hooks/           #   useEngine, useGameState, etc.
│   └── providers/       #   EngineProvider, ThemeProvider
├── content/             # Game config loader and content management
├── config/              # Environment and build configuration
└── pages/               # Top-level page components

public/
└── game-configs/
    ├── shared/           # Shared defaults (timings, HUD, features, layers)
    └── games/<game-id>/  # Per-game configs (manifest.json, network.json, layers/)
```

---

## 4. Architectural Layers

The framework uses a strict **7-layer architecture**. Dependencies flow **downward only** — upper layers depend on lower ones, never the reverse.

```
┌─────────────────────────────────────────────────┐
│                  UI Layer (React)                │  ← HUD, Controls, Modals
│                  src/ui/                         │
├─────────────────────────────────────────────────┤
│             Presentation Layer (Pixi)           │  ← Grid, Win Animations, Screens, Layers
│             src/presentation/                   │
├─────────────────────────────────────────────────┤
│              Gameplay Layer                     │  ← GameController, State, Timeline, Replay
│              src/gameplay/                      │
├─────────────────────────────────────────────────┤
│              Module System                      │  ← Spin Strategies, Features, Win Systems
│              src/modules/                       │
├─────────────────────────────────────────────────┤
│              Engine Layer                       │  ← Kernel, StateMachine, Flow, Plugins, Audio
│              src/engine/                        │
├─────────────────────────────────────────────────┤
│              Runtime Layer                      │  ← PixiApp, Ticker, Clock, Viewport, Pooling
│              src/runtime/                       │
├─────────────────────────────────────────────────┤
│              Platform Layer                     │  ← EventBus, Network, Audio, i18n, Logger
│              src/platform/                      │
└─────────────────────────────────────────────────┘
```

**Why this layering?**
- **Testability:** Lower layers have zero UI dependencies; they can be unit-tested in isolation.
- **Replaceability:** Swap Pixi.js for another renderer without touching game logic.
- **Reusability:** The same engine/modules power multiple games with different JSON configs.
- **Separation of concerns:** A developer working on win animations never needs to understand networking.

---

## 5. Bootstrap & Application Shell

**Path:** `src/bootstrap/`

| File | Purpose |
|------|---------|
| `main.tsx` | Vite entry point — creates React root, mounts `<App />` to DOM |
| `App.tsx` | Root component — wraps everything in `<Providers>` |
| `Providers.tsx` | Sets up React Query, theme, i18n, and other context providers |
| `Router.tsx` | Defines routes: `/` (Lobby), `/game/:gameId` (Game), `/debug` (Debug tools) |
| `ErrorBoundary.tsx` | Catches unhandled React errors, shows fallback UI instead of white screen |

### Route Structure

```
/                    → LobbyPage (game selection grid)
/game/:gameId        → GamePageWithSession (engine + canvas)
/debug               → DebugPage (development tools)
/404                 → NotFound
```

### Session Persistence on Route

The `GamePageWithSession` wrapper in `Router.tsx` checks `SessionTokenManager` before rendering:
1. If a valid session exists for the requested `gameId`, it restores it.
2. If a session exists for a *different* game, it clears it and starts fresh.
3. If no session exists, it allows a new game to start.

**Why?** Players can refresh the page or return to the game without losing their session state (balance, unfinished free spins, etc.).

---

## 6. Platform Layer — Infrastructure Services

**Path:** `src/platform/`

This layer provides foundational services used by every other layer. Components here have **zero game logic** — they are generic infrastructure.

---

### 6.1 EventBus — Deep Dive

**File:** `src/platform/events/EventBus.ts`

The EventBus is the **nervous system** of the entire framework. Every inter-component communication flows through it.

#### Architecture

```typescript
class EventBus {
  // Singleton instance — one bus per application
  private static instance: EventBus | null = null;

  // Map of event type → list of subscriptions (sorted by priority)
  private subscriptions: Map<string, EventSubscription[]>;

  // Circular buffer of recent events for debugging
  private eventHistory: EventEnvelope[];

  // Prevents recursive event processing from corrupting state
  private isProcessing: boolean;

  // Events emitted during processing are queued here
  private pendingEvents: { envelope: EventEnvelope }[];

  // Configurable tie-breaking strategy when priorities are equal
  private priorityTieBreaker: PriorityTieBreaker;
}
```

#### Key Operations

**Subscribe to an event:**
```typescript
// Type-safe — TypeScript enforces the correct payload type for 'game:spin:start'
const subId = eventBus.on('game:spin:start', (payload, envelope) => {
  console.log('Spin started with bet:', payload.bet);
}, 100); // priority 100 = runs before priority 0
```

**Emit an event:**
```typescript
// Type-safe — TypeScript enforces SpinStartPayload structure
eventBus.emit('game:spin:start', { bet: 10, lines: 1024 });
```

**One-time subscription:**
```typescript
eventBus.once('engine:ready', (payload) => {
  // Automatically unsubscribed after first invocation
});
```

**Unsubscribe:**
```typescript
eventBus.off(subId); // Remove by subscription ID
```

#### Priority-Based Dispatch

When an event fires, handlers are sorted by priority (higher number = runs first):

```typescript
// Priority 100 — Validation runs first
eventBus.on('game:spin:start', validateBalance, 100);

// Priority 0 (default) — Normal handlers
eventBus.on('game:spin:start', startReelAnimation);

// Priority -10 — Analytics runs last
eventBus.on('game:spin:start', logAnalytics, -10);
```

**Tie-Breaking:** When two handlers have the same priority, the `priorityTieBreaker` strategy determines order:
- `'insertion-order'` (default): Earlier `on()` call runs first
- `'reverse-insertion'`: Later `on()` call runs first
- `'stable-sort'`: Same as insertion-order (deterministic across JS runtimes)

**Why?** Validation must run before side effects. A validation handler can call `envelope.stopPropagation()` to cancel the spin before audio plays or reels start.

#### Event Queueing

If an event handler emits another event *during* event processing, the new event is **queued** (not processed immediately). This prevents stack overflow and ensures deterministic ordering:

```
emit('A') → processing handlers for A
  → handler emits 'B'     ← B is QUEUED, not processed yet
  → handler emits 'C'     ← C is QUEUED
  → all handlers for A complete
→ process queued: B, then C
```

#### Isolated Instances

`EventBus.createIsolated()` creates a **separate** EventBus instance that doesn't share state with the singleton. Used for:
- **Replay:** Replaying events without affecting the live game
- **Testing:** Unit tests can emit events without cross-test contamination

```typescript
const testBus = EventBus.createIsolated();
testBus.emit('game:spin:start', { bet: 10 }); // Only testBus listeners see this
```

---

### 6.2 EventEnvelope — Metadata & Integrity

**File:** `src/platform/events/EventEnvelope.ts`

Every event emitted through the EventBus is wrapped in an `EventEnvelope` that carries metadata:

```typescript
class EventEnvelope<T> {
  readonly type: string;           // Event type (e.g., 'game:spin:start')
  readonly payload: T;             // The typed payload data
  readonly timestamp: number;      // Date.now() when created
  readonly id: string;             // Unique ID: 'evt_{sequence}_{timestamp}'
  readonly sequence: number;       // Global auto-incrementing sequence number
  readonly hash: string | null;    // Integrity verification hash
}
```

**Why sequence numbers?**
- Events may have identical timestamps (sub-millisecond emissions).
- Sequence numbers guarantee **deterministic ordering** for replay.
- The replay system sorts by `sequence`, not `timestamp`, ensuring identical playback regardless of CPU speed.

**Why integrity hashes?**
- For GLI (Gaming Laboratories International) compliance, events must be verifiable.
- The hash is computed from `{type, payload, sequence, timestamp}`.
- `verifyIntegrity()` re-computes the hash and compares, detecting tampering.
- Current implementation uses a simple hash (dev); production should use SHA-256 via `crypto.subtle`.

**Propagation Control:**
```typescript
envelope.stop();              // Prevent all further processing
envelope.stopPropagation();   // Stop notifying lower-priority handlers (higher-priority already ran)
```

---

### 6.3 EventHistory — Circular Buffer

**File:** `src/platform/events/EventHistory.ts`

A **circular buffer** that stores the last N events (default: 100) for debugging and inspection.

```
Buffer: [evt_1, evt_2, ..., evt_100]
         ↑ pointer wraps around when full
```

**Why circular?** Fixed memory footprint. No matter how many events fire, memory usage stays constant.

**API:**
```typescript
history.push(envelope);              // Add event (overwrites oldest when full)
history.getAll();                     // All events in chronological order
history.getLast(10);                  // Last 10 events
history.getByType('game:spin:start'); // Filter by type
```

**Use case:** The Debug page reads `EventHistory` to show a live event log. Developers can inspect what events fired and in what order.

---

### 6.4 EventScheduler — Delayed & Repeating Events

**File:** `src/platform/events/EventScheduler.ts`

Schedules events to fire in the future, either once or repeatedly.

```typescript
const scheduler = new EventScheduler(eventBus);

// Fire 'ui:toast:show' after 3 seconds
scheduler.schedule('ui:toast:show', { message: 'You won!' }, 3000);

// Fire 'game:idle:check' every 5 seconds, 10 times
scheduler.scheduleRepeat('game:idle:check', {}, 5000, 10);

// Cancel a scheduled event
scheduler.cancel(id);
```

**How it works:** The scheduler's `update()` method is called each frame (via `PixiTicker`). It checks if any scheduled events have passed their `executeAt` timestamp and emits them.

**Why not `setTimeout`?** The scheduler integrates with the game loop, respecting pause/resume. When the game is paused, the ticker stops, and scheduled events don't fire. `setTimeout` would fire regardless of game state.

---

### 6.5 EventTimeline — Debug Recording

**File:** `src/platform/events/EventTimeline.ts`

Records events with **relative timestamps** from a start point. Used for debugging and visualization.

```typescript
const timeline = new EventTimeline();
timeline.startRecording();

// ... game plays for 5 seconds ...

timeline.stopRecording();

// Get events between 1s and 3s of recording
const subset = timeline.getEntriesInRange(1000, 3000);

// Export for analysis
const json = timeline.export();
```

**Difference from EventHistory:** History is always-on (circular buffer, fixed size). Timeline is opt-in recording with relative timestamps, exportable for offline analysis.

---

### 6.6 EventTracker — Performance Monitoring

**File:** `src/platform/events/EventTracker.ts`

Tracks statistics about event emissions for performance analysis.

```typescript
const tracker = new EventTracker();
tracker.track('game:spin:start', 2.5); // Event took 2.5ms to process

// Later:
tracker.getStats('game:spin:start');
// → { type: 'game:spin:start', count: 150, lastEmitted: 1708300000, averageHandlerTime: 1.8 }

tracker.getTopByCount(5); // Top 5 most-emitted events
tracker.getTotalCount();   // Total events tracked
```

**Why?** In development, if `game:spin:start` suddenly takes 50ms to process (instead of 2ms), the tracker reveals this regression immediately. Helps identify performance-critical event handlers.

---

### 6.7 Networking — Adapter Pattern

**Path:** `src/platform/networking/`

```
┌─────────────────┐
│  NetworkManager  │  ← Unified API: gameLaunch(), spin(), featureAction(), buyBonus()
└────────┬────────┘
         │ delegates to active adapter
         ▼
┌────────────────────────────────────────────┐
│          INetworkAdapter interface          │
├──────────┬──────────────┬─────────────────┤
│ REST     │   STOMP      │    Mock          │
│ Adapter  │   Adapter    │    Adapter       │
│          │              │                  │
│ HTTP     │ WebSocket    │ In-memory        │
│ fetch()  │ persistent   │ MockGameServer   │
│          │ connection   │ (simulated RNG)  │
└──────────┴──────────────┴─────────────────┘
```

| File | Purpose |
|------|---------|
| `NetworkManager.ts` | Unified API — delegates to the active adapter |
| `INetworkAdapter.ts` | Interface all adapters implement |
| `RestAdapter.ts` | HTTP/REST implementation using `fetch()` |
| `StompAdapter.ts` | WebSocket/STOMP for real-time server push |
| `MockAdapter.ts` | In-memory mock for development/testing |
| `MockGameServer.ts` | Simulates server-side logic (RNG, paytable, balance, cascades) |
| `SessionTokenManager.ts` | JWT-like token management with `localStorage` persistence |
| `APIProtocol.ts` | Request/response type definitions for all API endpoints |
| `PayloadMapper.ts` | Maps raw server responses to internal domain types |
| `PayloadValidator.ts` | Validates server payloads against expected schemas |
| `RetryPolicy.ts` | Configurable retry with exponential backoff |

**Adapter Selection Priority:**
1. Runtime override (`config.networkMode` in `EngineConfig`)
2. Per-game config (`public/game-configs/games/<gameId>/network.json`)
3. Environment config (`src/config/env.config.ts`)

**Why the Adapter Pattern?**
- **Development:** `MockAdapter` — no server needed, instant feedback, deterministic results.
- **Integration testing:** `RestAdapter` against a staging server.
- **Production:** `StompAdapter` for real-time, persistent WebSocket connections.
- **Runtime switching:** `networkManager.setAdapter('rest')` — useful for failover (STOMP → REST on WebSocket failure).

---

### 6.8 Audio Infrastructure

| File | Purpose |
|------|---------|
| `AudioBus.ts` | Event-driven audio routing |
| `AudioRegistry.ts` | Sound asset registry and lookup by key |
| `SoundManager.ts` | Low-level Howler.js wrapper (play, stop, volume, sprite sheets) |

This is the **infrastructure** layer. The **engine audio** layer (`src/engine/audio/`) builds on top of this — see [Section 7.7](#77-audio-engine).

---

### 6.9 Localization

| File | Purpose |
|------|---------|
| `LocaleManager.ts` | Language switching and string lookup |
| `LocaleResolver.ts` | Resolves locale from browser settings or config |
| `LanguagePack.ts` | Loads language packs dynamically |
| `strings.*.json` | Translation files (en, de, es, ar, hi, ru, zh, zh-TW) |

---

### 6.10 Logger

| File | Purpose |
|------|---------|
| `Logger.ts` | Named logger instances: `Logger.create('GameController')` |
| `LogLevel.ts` | DEBUG, INFO, WARN, ERROR levels |
| `LogFormatter.ts` | Structured log formatting with timestamp, component name |
| `LoggerController.ts` | Global log level control (set all loggers to WARN in production) |
| `LoggerFactory.ts` | Logger instance creation and caching |
| `transports/` | Console transport, remote transport (for server-side logging), buffer transport |

---

## 7. Engine Layer — The Brain

**Path:** `src/engine/`

The engine orchestrates the entire game lifecycle — from initialization through running to destruction.

---

### 7.1 EngineKernel — The Orchestrator

**File:** `src/engine/core/EngineKernel.ts`

The `EngineKernel` is the **central coordinator** of the entire framework. It's a singleton that:
- Initializes all subsystems in a specific order
- Holds references to all major services
- Manages engine state transitions (UNINITIALIZED → LOADING → READY → RUNNING)
- Listens for feature changes to swap spin strategies dynamically
- Provides a clean `destroy()` that tears down everything in reverse order

**Engine States:**
```typescript
enum EngineState {
  UNINITIALIZED,  // Before initialize() is called
  INITIALIZING,   // During initialize()
  LOADING,        // GameLoader is running 6-phase sequence
  READY,          // All subsystems initialized, waiting to start
  RUNNING,        // Game loop active
  PAUSED,         // Ticker stopped, audio muted
  ERROR,          // Something failed — see lastError
  DESTROYED,      // After destroy() — all singletons reset to null
}
```

**Services owned by EngineKernel:**
```
EngineKernel
├── EventBus              (platform)
├── PixiApplicationManager (runtime)
├── StageManager           (runtime)
├── ScreenManager          (presentation)
├── TickManager            (gameplay)
├── GameController         (gameplay)
├── PresentationOrchestrator (gameplay)
├── GameConfigLoader       (content)
├── GameLoader             (engine)
├── NetworkManager         (platform)
├── AudioManager           (engine)
├── AudioController        (engine)
├── GameSession            (gameplay)
├── SessionTokenManager    (platform)
└── 7 visual layers        (presentation)
```

---

### 7.2 Game Initialization Sequence (Deep Dive)

When `EngineKernel.initialize(config)` is called, the following happens **in strict order**:

```
Step 1:  NetworkManager.initializeForGame(gameId)
         ├── Load per-game network.json
         ├── Create appropriate adapter (Mock/REST/STOMP)
         └── Connect to server

Step 2:  GameLoader.loadGame(gameId, userId)
         ├── Phase 1: Check SessionTokenManager for existing session
         ├── Phase 2: NetworkManager.gameLaunch() → server validates & returns config
         ├── Phase 3: GameConfigLoader.loadGame() → merge JSON configs
         ├── Phase 4: AssetPreloader.preload() → textures, spine, audio (with fallback)
         ├── Phase 5: Stage creation marker (deferred to kernel)
         └── Phase 6: Ready

Step 3:  PixiApplicationManager.initialize()
         ├── Create PixiRuntime (WebGL canvas)
         ├── Create PixiTicker (wraps Pixi's ticker)
         ├── Create PixiClock (high-precision timing)
         └── Insert canvas into DOM

Step 4:  Inject responsive layouts into PixiRuntime
         └── From game config: breakpoints, virtual dimensions per orientation

Step 5:  StageManager.initialize()
         └── Create StageRoot with 12 z-ordered LayerContainers

Step 6:  Create PixiTicker (separate from PixiApplicationManager's ticker)

Step 7:  ConfigurableSymbolPool.getInstance(120)
         └── Pre-create 120 pooled symbol sprites for recycling

Step 8:  composeLayers()
         ├── BackgroundLayer   → StageLayer.BACKGROUND (z=0)
         ├── TitleLayer        → StageLayer.TITLE      (z=200)
         ├── ScreenLayer       → StageLayer.SCREEN     (z=300)
         ├── TransitionLayer   → StageLayer.TRANSITION (z=700)
         ├── ToastLayer        → StageLayer.TOAST      (z=800)
         ├── OverlayLayer      → StageLayer.OVERLAY    (z=900)
         └── DebugLayer        → StageLayer.DEBUG      (z=1000)

Step 9:  ScreenManager.initialize(screenLayer, transitionLayer)

Step 10: BaseScreen created and registered with ScreenManager

Step 11: TickManager.initialize(ticker)
         ├── Register 'screen-update' callback (NORMAL priority)
         └── Register 'grid-update' callback (HIGH priority)

Step 12: GameController.initFromSession(session)
         └── Restore balance, bet, last round from session data

Step 13: AudioManager.initialize()
         └── AudioController.mount(gameId) — wire EventBus → audio

Step 14: Apply initial spin strategy from config
         └── e.g., "cascade" strategy for cascade games

Step 15: PresentationOrchestrator.getInstance()

Step 16: ScreenManager.switchTo('BaseScreen', false)

Step 17: eventBus.emit('engine:ready', { timestamp })
         └── UI receives this and shows the game
```

**Why this order matters:**
- Network must be ready before GameLoader can call `gameLaunch()`
- Assets must be loaded before layers can render backgrounds/symbols
- ScreenManager needs layers before it can switch screens
- GameController needs session data before it can accept spin requests

**Destroy order is the reverse:**
```
AudioController → AudioManager → TickManager → GameController →
PresentationOrchestrator → SymbolPool → ScreenManager → StageManager →
PixiManager → ConfigLoader → GameLoader → NetworkManager → EventBus
```

---

### 7.3 EngineStateMachine — Guarded Transitions

**File:** `src/engine/core/EngineStateMachine.ts`

A finite state machine controlling valid game state transitions.

```
UNINITIALIZED → INITIALIZING → IDLE
                                 ↕
IDLE ← → SPINNING → EVALUATING → PRESENTING → IDLE
  ↕                                    ↓
PAUSED                             FEATURE → IDLE
  ↕                                    ↓
DESTROYED                         SPINNING (re-trigger)

Any state → ERROR → IDLE or DESTROYED
```

**Guards:** Transition functions that must return `true` for a transition to proceed:
```typescript
// Example guard: only allow spin if balance >= bet
guards.set('IDLE→SPINNING', () => walletState.balance >= walletState.bet);
```

**Why a state machine?**
- Prevents invalid operations (e.g., spinning while already spinning)
- Makes debugging deterministic — full state history is logged
- Guards enforce business rules at the state level

---

### 7.4 GameLoader — 6-Phase Loading Pipeline

**File:** `src/engine/core/GameLoader.ts`

Orchestrates the complete game initialization with weighted progress reporting.

**Phases and their weights (for progress bar):**

| Phase | Weight | What Happens |
|-------|--------|-------------|
| `CHECKING_SESSION` | 5% | Check `SessionTokenManager` for existing session |
| `LAUNCHING_GAME` | 15% | Send `gameLaunch` request to server, get config + balance |
| `LOADING_CONFIG` | 10% | Load and merge JSON configs (shared + game-specific) |
| `LOADING_ASSETS` | 55% | Preload textures, spine animations, audio, fonts |
| `CREATING_STAGE` | 10% | Marker phase (actual stage creation in EngineKernel) |
| `READY` | 5% | Emit `game:loaded` event |

**Asset Loading with Fallback:**

Each game can configure how asset failures are handled:
```json
{
  "loading": {
    "assetLoadBehavior": "useDefaults",   // or "showError" or "retry"
    "showErrorOnFailure": false,          // true = crash on missing assets
    "maxRetries": 2
  }
}
```

- `"useDefaults"` (default): If textures fail to load, use programmatic colored rectangles instead (graceful degradation)
- `"showError"`: Show error screen — used for games that require specific art assets
- `"retry"`: Retry failed assets up to `maxRetries` times

---

### 7.5 Flow System

**Path:** `src/engine/flow/`

The `FlowSystem` manages high-level game round sequences:

```
SPIN Flow:
  SPIN_START → REELS_SPINNING → REELS_STOPPING → WIN_EVALUATION → SPIN_COMPLETE

FREE_SPINS Flow:
  FEATURE_TRIGGER → FEATURE_INTRO → FEATURE_PLAY

WIN_PRESENTATION Flow:
  WIN_EVALUATION → WIN_PRESENTATION
```

**Why a Flow System?**
- Ensures steps execute in the correct order
- Supports flow queuing — if a bonus triggers during a spin, it queues after completion
- Each flow type can be customized per game via config

---

### 7.6 Plugin System

**Path:** `src/engine/plugin/`

Every module (feature, win system, mechanic) extends `SlotPlugin`:

```typescript
abstract class SlotPlugin {
  id: string;              // Unique identifier
  version: string;         // Semantic version
  priority: PluginPriority; // Load order: CRITICAL(0) → HIGH(25) → NORMAL(50) → LOW(75) → OPTIONAL(100)
  dependencies: string[];   // Required plugins (must load first)
  enabled: boolean;         // Active state

  abstract onLoad(): Promise<void>;    // Async initialization
  abstract onUnload(): Promise<void>;  // Cleanup
  abstract onEnable(): void;           // Activate (subscribe to events)
  abstract onDisable(): void;          // Deactivate (unsubscribe)
}
```

**Load Order Resolution:**
1. **Priority:** Lower number = loads first (CRITICAL before OPTIONAL)
2. **Dependencies:** `PluginDependencyGraph` performs topological sort — if A depends on B, B loads first regardless of priority

**Registration Flow:**
```
ModuleRegistry.initialize()
  ├── registerSpinStrategies() → SpinStrategyRegistry
  │   └── cascade, cluster, megaways, infinity, dualboard
  ├── registerFeatures() → PluginRegistry
  │   └── freespins, stickywild, expandingwild, multiplier, bonus
  ├── registerWinSystems() → PluginRegistry
  │   └── paylines, ways, cluster, megaways
  └── registerSpinMechanisms() → SpinMechanismRegistry
      └── holdRespin, lockSequence, multiSpin, collection, etc.
```

---

### 7.7 Audio Engine

**Path:** `src/engine/audio/`

```
┌─────────────────┐     events      ┌──────────────────┐
│  AudioController │ ←────────────── │     EventBus     │
│  (game-specific) │                 └──────────────────┘
└────────┬────────┘
         │ commands
         ▼
┌─────────────────┐
│  AudioManager    │  ← channels, volume, focus handling, pause/resume
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SoundManager    │  ← Howler.js wrapper
└─────────────────┘
```

| File | Purpose |
|------|---------|
| `AudioManager.ts` | High-level control: channels, global mute, browser tab visibility handling |
| `AudioController.ts` | Maps EventBus events to sounds per game (mounted per gameId) |
| `AudioChannel.ts` | Named audio channels (SFX, Music, Ambient) with independent volume |
| `AudioConfigResolver.ts` | Resolves audio config from game JSON |
| `AudioEventBus.ts` | Audio-specific event routing |
| `AudioSpriteLoader.ts` | Loads audio sprite sheets for efficient playback |

**Event-driven audio mapping:**
```
game:spin:start     → play "reel_spin" (loop)
reel:spin:stop      → play "reel_stop" (one-shot)
game:win:detected   → play "win_small" / "win_big" (based on amount)
feature:triggered   → play "feature_fanfare"
engine:pause        → mute all channels
engine:resume       → restore channel volumes
```

**Why event-driven?** Audio is completely decoupled. Replacing sound assets requires zero code changes. Audio can be disabled/mocked for testing.

---

### 7.8 Data Persistence

**Path:** `src/engine/data/`

| File | Purpose |
|------|---------|
| `DataStore.ts` | Generic key-value store for game data |
| `DataHydrator.ts` | Reconstructs state from serialized data (page refresh recovery) |
| `DataSerializer.ts` | Serializes state for `localStorage` or server persistence |
| `DataSnapshot.ts` | Point-in-time state captures for debugging |

---

## 8. Module System — Pluggable Game Mechanics

**Path:** `src/modules/`

### 8.1 Registry

| File | Purpose |
|------|---------|
| `ModuleRegistry.ts` | Registers all available modules at startup |
| `SpinStrategyRegistry.ts` | Registry specifically for spin strategies |

### 8.2 Spin Strategies (`src/modules/mechanics/`)

Each strategy defines how reels behave during a spin:

| Mechanic | Description |
|----------|-------------|
| **Standard** | Classic top-to-bottom reel spin |
| **Cascade** | Winning symbols disappear, new ones fall in (Tumble/Avalanche) |
| **Cluster** | Wins by clusters of adjacent symbols (no paylines) |
| **Megaways** | Variable reel heights per spin (up to 117,649 ways) |
| **Infinity** | Endless expanding grid |
| **Dual Board** | Two grids side by side |

**Selection is config-driven:**
```json
{ "baseGame": { "spinStrategy": "cascade" } }
```

### 8.3 Features (`src/modules/features/`)

| Feature | Description |
|---------|-------------|
| **Free Spins** | Awarded spins at no cost, often with multipliers |
| **Sticky Wilds** | Wild symbols persist across spins |
| **Expanding Wilds** | Wilds expand to fill entire reel |
| **Multipliers** | Win multiplier progression |
| **Bonus** | Pick-and-reveal bonus rounds |
| **Spin Mechanisms** | Hold & Respin, Lock Sequence, Multi-Spin, Collection, etc. |

### 8.4 Win Systems (`src/modules/winsystems/`)

| System | Description |
|--------|-------------|
| **Paylines** | Fixed lines (e.g., 20 lines) — `LineEvaluator` |
| **Ways** | All-ways (e.g., 243 or 1024 ways) — `WaysEvaluator` |
| **Cluster** | Adjacent symbol clusters — `ClusterEvaluator` |
| **Megaways** | Variable ways with dynamic reel heights — `MegawaysEvaluator` |

> **Important:** In production, the **server** evaluates wins. These client-side evaluators are used for the **mock adapter** and visual presentation logic only.

---

## 9. Gameplay Layer — Game Logic & Orchestration

**Path:** `src/gameplay/`

---

### 9.1 GameController — The Main Loop

**File:** `src/gameplay/engine/GameController.ts`

The `GameController` is the main game loop. It handles the complete spin lifecycle:

```
1. User clicks SPIN button
2. UI emits 'game:spin:request' { bet, lines }
3. GameController.onSpinRequest():
   a. Validate state === IDLE
   b. Validate balance >= bet
   c. Deduct bet optimistically (instant UI feedback)
   d. Emit 'game:spin:start'
   e. Start SpinLoop (reels begin spinning visually)
   f. Send spin request to server via NetworkManager
4. Server responds with SpinResponse
5. GameController:
   a. Parse response via PayloadMapper
   b. Update balance from server (authoritative — overrides optimistic deduction)
   c. Emit 'game:spin:result' with initial matrix
   d. Stop SpinLoop with server-provided symbols (reels stop)
   e. Wait for 'game:reels:stopped'
6. On reels stopped:
   a. Run step-by-step presentation (ResultPresentationController)
   b. For each step: show wins, cascade, multipliers
   c. Apply final grid state
   d. Emit 'game:spin:complete'
7. State → IDLE (ready for next spin)
```

**Other key files in `src/gameplay/engine/`:**

| File | Purpose |
|------|---------|
| `SpinLoop.ts` | Controls reel spin start/stop timing and visual animation |
| `PresentationOrchestrator.ts` | Orchestrates visual win presentations |
| `ResultPresentationController.ts` | Step-by-step result presentation (RESULT → CASCADE → WIN) |
| `StepSequencePresenter.ts` | Presents individual spin result steps |
| `FlowOrchestrator.ts` | Higher-level flow coordination |
| `GameClock.ts` | Game-relative time tracking |
| `TickManager.ts` | Frame tick distribution to registered listeners |
| `PauseManager.ts` | Pause/resume logic |
| `VisibilityManager.ts` | Browser tab visibility handling (pause when tab hidden) |
| `Scheduler.ts` | Delayed action scheduling |

---

### 9.2 State Management

**Path:** `src/gameplay/state/`

State is managed through **singleton service classes** rather than a centralized store:

```
GameSession (master aggregator)
├── GameModel       — Grid dimensions, ways count, game ID
├── RoundState      — Current round: matrix, wins, steps, cascade level
├── WalletState     — Balance, bet, currency, pending bet
├── FeatureState    — Active feature, remaining spins, multiplier, accumulated wins
└── UserModel       — Player ID, preferences
```

**State flow:**
```
Server Response → PayloadMapper → GameSession.update() → EventBus.emit() → UI/Pixi react
```

| File | Purpose |
|------|---------|
| `GameSession.ts` | Master session state — aggregates all sub-states, session persistence |
| `RoundState.ts` | Current round data (matrix, wins, steps, cascade progress) |
| `WalletState.ts` | Balance, bet, currency, optimistic deduction tracking |
| `FeatureState.ts` | Active feature tracking (free spins remaining, multiplier progress) |
| `StateSerializer.ts` | Serialize/deserialize for `localStorage` persistence |

**Why not Redux/Zustand?**
- The engine runs **outside React** — it needs state accessible from non-React code (Pixi containers, audio controllers, timeline actions).
- Singleton services with EventBus notifications provide the same reactivity pattern with less boilerplate.
- State changes emit events — any subscriber (React hook, Pixi container, logger) can react.

---

### 9.3 Timeline System — Deep Dive

**Path:** `src/gameplay/timeline/`

The timeline system provides a **declarative API** for sequencing complex animation and presentation flows. Think of it as a programmable animation timeline (like GSAP's Timeline, but for game logic).

#### Core Components

| File | Purpose |
|------|---------|
| `TimelineRunner.ts` | Executes a sequence of `TimelineAction`s with pause/resume/skip/loop support |
| `SequenceBuilder.ts` | Fluent builder API for constructing timelines |
| `DelayAction.ts` | Waits for a specified duration (cancellable via `CancellationToken`) |
| `ParallelAction.ts` | Runs multiple actions simultaneously via `Promise.all()` |
| `LoopAction.ts` | Repeats a set of actions N times |
| `ConditionalAction.ts` | Branches based on a runtime condition |
| `TimelineTypes.ts` | Type definitions including `CancellationToken` |

#### TimelineAction Interface

Every action in the timeline implements:

```typescript
interface TimelineAction {
  id: string;
  type: 'sequence' | 'parallel' | 'delay' | 'loop' | 'conditional' | 'callback';
  execute: (token?: CancellationToken) => Promise<void>;
  duration?: number;    // Expected duration in ms (for progress calculation)
  priority?: number;
}
```

#### SequenceBuilder — Fluent API

```typescript
const timeline = new SequenceBuilder('win-presentation')
  // Wait 500ms
  .delay(500)

  // Run two things in parallel: fade in overlay + play sound
  .parallel([
    new FadeInAction(winOverlay),
    new SoundAction('win_fanfare'),
  ])

  // Loop highlight animation 3 times
  .loop(3, (seq) => {
    seq.call(() => highlightWinLine(0))
       .delay(800)
       .call(() => clearHighlight());
  })

  // Conditional: big win gets extra celebration
  .if(
    () => totalWin > 100,
    (seq) => seq.call(() => showBigWinAnimation()),
    (seq) => seq.call(() => showSmallWinText())
  )

  // Wait for an async operation
  .await(() => fadeOutOverlay())

  .build(); // Returns TimelineAction[]
```

#### TimelineRunner — Execution Engine

```typescript
const runner = new TimelineRunner({
  loop: false,
  onComplete: () => console.log('Done!'),
  onUpdate: (progress) => updateProgressBar(progress),  // 0.0 → 1.0
  onError: (error) => handleError(error),
});

runner.setActions(timeline);
await runner.start();
```

**Runner capabilities:**
- `start()` — Begin execution
- `pause()` / `resume()` — Suspend/continue
- `stop()` — Cancel immediately (triggers CancellationToken)
- `reset()` — Stop and rewind to beginning
- `skipTo(index)` — Jump to a specific action
- `getProgress()` — Returns 0.0–1.0 based on elapsed duration vs. total

#### CancellationToken — Safe Interruption

When the user presses "skip" or turbo mode activates, long-running timeline actions need to abort gracefully.

```typescript
class CancellationTokenImpl {
  cancel(): void;                    // Trigger cancellation
  get isCancelled(): boolean;        // Check if cancelled
  onCancel(callback: () => void): void;  // Register cleanup callback
  throwIfCancelled(): void;          // Throw if cancelled (for eager abort)
}
```

**How `DelayAction` uses it:**
```typescript
async execute(token?: CancellationToken): Promise<void> {
  if (token?.isCancelled) return;  // Already cancelled? Skip entirely

  return new Promise((resolve) => {
    const t = window.setTimeout(() => resolve(), this.duration);

    token?.onCancel(() => {       // If cancelled during wait:
      window.clearTimeout(t);      //   Clear the timeout
      resolve();                    //   Resolve immediately (don't reject)
    });
  });
}
```

**Why not just reject the promise?** Rejecting would propagate an error up the call stack, requiring try/catch everywhere. Instead, cancellation is a **graceful early completion** — the timeline simply moves forward.

#### Error Handling

The `TimelineRunner` has two levels of error boundaries:

1. **Action-level:** If a single action throws, the runner logs it, stores it in `state.lastError`, calls `config.onError()`, and re-throws.
2. **Timeline-level:** The outer try/catch catches the re-thrown error, sets `state.isFailed = true`, and ensures `state.isRunning = false` (fail-closed: no zombie timelines).

---

### 9.4 Timing & Turbo Mode

**Path:** `src/gameplay/timing/`

#### TimingProvider

All animation/presentation timings are read from JSON config via `TimingProvider`:

```typescript
interface TimingProvider {
  getMs(key: TimingKey): number;          // Throws if key missing
  getOptionalMs(key: TimingKey): number | undefined;  // Returns undefined if missing
  getAll(): TimingMap;
}
```

**Example timing keys** (from `public/game-configs/games/neon-nights/timings.json`):
```json
{
  "win.paylineLoop.step": 1800,
  "win.paylineLoop.max": 12000,
  "cascade.winPresentation": 500,
  "cascade.removal": 350,
  "cascade.collapse": 400,
  "cascade.refill": 350,
  "cascade.interStepDelay": 200
}
```

#### TurboState — Speed Multiplier

When turbo mode is active, `TimingProvider.getMs()` automatically divides all timing values by the turbo speed multiplier:

```typescript
class TurboState {
  private _active = false;
  private _speedMultiplier = 2;  // From config: turbo.speedMultiplier

  divisor(): number {
    return this._active ? this._speedMultiplier : 1;
  }
}

// In TimingProvider:
getMs(key: TimingKey): number {
  const v = this.timings[key];
  return Math.max(0, Math.round(v / TurboState.getInstance().divisor()));
}
```

**Result:** When turbo is ON with 2× multiplier:
- `cascade.removal` returns 175ms instead of 350ms
- `win.paylineLoop.step` returns 900ms instead of 1800ms
- Callers don't need any turbo-awareness — `getMs()` handles it transparently

**Special keys:** `turbo.speedMultiplier` itself is never divided (it's the raw config value).

**Toggle:** `TurboState.toggle()` emits `'ui:turbo:changed'` on the EventBus so UI can update the turbo button state.

---

### 9.5 Replay System — Deep Dive

**Path:** `src/gameplay/replay/`

The replay system records and plays back game rounds for debugging, QA, and regulatory compliance.

#### ReplayRecorder

```typescript
class ReplayRecorder {
  // Events recorded by default:
  // game:spin:request, game:spin:start, game:spin:result, game:spin:complete,
  // game:reel:spin:start, game:reel:spin:stop,
  // feature:start, feature:end, wallet:balance:update
}
```

**Recording a session:**
```typescript
const recorder = ReplayRecorder.getInstance();
recorder.startRecording('neon-nights', 1000, 10); // gameId, balance, bet

// ... player plays several spins ...

const session = recorder.stopRecording();
// session.events = [{ sequence: 1, type: 'game:spin:request', payload: {...}, hash: '...' }, ...]
```

**How it works:** On `startRecording()`, the recorder subscribes to all tracked event types on the EventBus. Each event is stored with:
- `timestamp`: Relative time from recording start (not absolute — enables speed-adjusted playback)
- `sequence`: From `EventEnvelope.sequence` (deterministic ordering)
- `hash`: From `EventEnvelope.hash` (integrity verification)
- `roundId`: Extracted from payload if present

**Integrity verification:**
```typescript
recorder.verifySessionIntegrity(session); // Checks all event hashes
```

#### ReplayPlayer

```typescript
class ReplayPlayer {
  private eventBus: EventBus;      // Live bus (reference only)
  private replayBus: EventBus;     // Isolated shadow bus for replay
}
```

**Critical design decision: Isolated replay bus.**

The ReplayPlayer creates a **separate EventBus instance** via `EventBus.createIsolated()`. Replayed events are emitted on this isolated bus, **not** the live game bus. This prevents replay from:
- Triggering real network requests
- Modifying actual balance
- Playing audio during replay
- Corrupting live game state

**Playback:**
```typescript
const player = ReplayPlayer.getInstance();
player.loadSession(session);
player.play({
  speed: 2,  // 2x playback speed
  onEventPlayed: (event) => console.log(event.type),
  onComplete: () => console.log('Replay finished'),
  onProgress: (p) => updateProgressBar(p),  // 0.0 → 1.0
});

// Controls:
player.pause();
player.resume();
player.setSpeed(4);           // Change speed during playback
player.skipToEvent(15);       // Jump to event #15
player.skipToTime(5000);      // Jump to 5 seconds into recording
```

**Event ordering:** Events are sorted by `sequence` (not `timestamp`) for deterministic playback. This ensures identical event ordering regardless of CPU speed during recording vs. playback.

**Subscribing to replay events:**
```typescript
player.onReplayEvent('game:spin:result', (payload) => {
  // Render the replay visually on a replay-specific canvas
});
```

---

## 10. Runtime Layer — Pixi.js Rendering

**Path:** `src/runtime/pixi/`

---

### 10.1 PixiApplicationManager — Subsystem Coordinator

**File:** `src/runtime/pixi/core/PixiApplicationManager.ts`

High-level manager that creates and coordinates all Pixi subsystems:

```
PixiApplicationManager
├── PixiRuntime        — The Pixi.js Application instance, canvas, renderer
├── PixiTicker         — Frame-by-frame update loop with priority callbacks
└── PixiClock          — High-precision game clock
```

**Lifecycle states:**
```
UNINITIALIZED → INITIALIZING → READY → RUNNING ↔ PAUSED → DESTROYED
```

**Initialization:**
```typescript
await pixiManager.initialize({
  containerId: 'game-container',  // DOM element to insert canvas into
  backgroundColor: 0x0a0e14,
  enableDebug: true,
  targetFPS: 60,                  // Caps Pixi ticker FPS
});
```

**What happens during initialize:**
1. `PixiRuntime.getInstance()` creates the Pixi `Application` and WebGL canvas
2. `PixiTicker` wraps Pixi's native ticker for priority-based callback management
3. `PixiClock` starts tracking game time with `performance.now()`
4. Clock update is registered as a ticker callback
5. Canvas is inserted into the specified DOM container

---

### 10.2 PixiTicker — The Game Loop

**File:** `src/runtime/pixi/core/PixiTicker.ts`

The `PixiTicker` wraps Pixi.js's native `Ticker` to add priority-based callback ordering and time scaling.

**How it works:**

Every frame (~16.67ms at 60fps), the Pixi ticker fires. Our `PixiTicker` intercepts this and:

1. Checks if paused → if yes, skip everything
2. Calculates `deltaTime` (normalized: 1.0 = one frame at 60fps) and `deltaMs` (raw milliseconds)
3. Applies `timeScale` (for slow-motion or fast-forward effects)
4. Sorts callbacks by priority if any were added/removed since last frame
5. Executes all active callbacks in priority order (CRITICAL → HIGH → NORMAL → LOW)

```typescript
enum TickerPriority {
  LOW = 0,
  NORMAL = 50,
  HIGH = 100,
  CRITICAL = 200,
}
```

**Registered callbacks in a typical game:**

| Callback ID | Priority | Purpose |
|-------------|----------|---------|
| `clock` | NORMAL | Update PixiClock each frame |
| `grid-update` | HIGH | Update grid/reel animations (must run before screen) |
| `screen-update` | NORMAL | Update current screen (BaseScreen, etc.) |

**Time scaling:**
```typescript
ticker.setTimeScale(0.5);  // Half speed (slow motion)
ticker.setTimeScale(2.0);  // Double speed
ticker.setTimeScale(0);    // Frozen (effectively paused)
```

**Why wrap Pixi's ticker?**
- Priority ordering: Grid animations must update before screen layout calculations
- Time scaling for turbo/debug modes
- Named callbacks: `ticker.remove('grid-update')` instead of keeping function references
- Error isolation: If one callback throws, others still execute

---

### 10.3 PixiClock — High-Precision Timing

**File:** `src/runtime/pixi/core/PixiClock.ts`

A high-precision game clock using `performance.now()` (microsecond resolution, not affected by system clock changes).

```typescript
class PixiClock {
  getTime(): number;         // Milliseconds since clock started (accounts for pause time)
  getTimeSeconds(): number;  // Same, in seconds
  getDeltaTime(): number;    // Normalized delta (1.0 = one frame at 60fps)
  getDeltaMs(): number;      // Raw delta in milliseconds
  getFrameCount(): number;   // Total frames since start
}
```

**Pause handling:** When paused, the clock records `pausedAt`. On resume, it adds the paused duration to `totalPausedTime`. This means `getTime()` reflects **game time** (time the game was actually running), not wall-clock time.

```
Wall clock:  0s    1s    2s    3s    4s    5s    6s
Game state:  RUN   RUN   PAUSE PAUSE RUN   RUN   RUN
Game time:   0s    1s    1s    1s    2s    3s    4s
```

**Why not just use `Date.now()`?**
- `Date.now()` resolution is 1ms; `performance.now()` is sub-millisecond
- `Date.now()` can jump if the system clock is adjusted
- Game time must pause when the game pauses — `Date.now()` doesn't support this

---

### 10.4 Viewport & Resizing — Deep Dive

**Path:** `src/runtime/pixi/viewport/`

The viewport system ensures the game looks correct on **any screen size**, from a 320px phone to a 4K monitor.

#### Architecture

```
┌──────────────────────┐
│   ViewportManager    │  ← Central coordinator (calculates scale, offset, safe areas)
└──────────┬───────────┘
           │ uses
  ┌────────┼────────────────────────┐
  │        │                        │
  ▼        ▼                        ▼
AspectScaler  ResizeObserverWrapper  OrientationObserver
(math)        (DOM resize events)    (portrait/landscape)
  │
  ├── LetterboxCalculator (black bar dimensions)
  ├── DPRResolver (device pixel ratio)
  └── SafeAreaManager (notch/safe-area-inset handling)
```

#### How Resizing Works

1. **Detection:** `ResizeObserverWrapper` watches the game container element for size changes (debounced at 16ms to avoid flooding)

2. **Orientation:** `OrientationObserver` uses `window.matchMedia('(orientation: landscape)')` to detect orientation changes. Falls back to comparing `window.innerWidth` vs `innerHeight`.

3. **Virtual dimensions:** The game is designed at a fixed "virtual" resolution (e.g., 1920×1080 for landscape, 1080×1920 for portrait). The `PixiRuntime` stores responsive layouts from config:
   ```json
   {
     "responsive": {
       "layouts": {
         "desktop": { "virtualWidth": 1920, "virtualHeight": 1080 },
         "mobile-landscape": { "virtualWidth": 1440, "virtualHeight": 810 },
         "mobile-portrait": { "virtualWidth": 1080, "virtualHeight": 1920 }
       }
     }
   }
   ```

4. **Scaling:** `ViewportManager.update(screenWidth, screenHeight)` runs `AspectScaler.contain()`:
   ```
   scaleX = screenWidth / virtualWidth
   scaleY = screenHeight / virtualHeight
   scale = Math.min(scaleX, scaleY)   ← "contain" mode: fit without cropping
   ```

5. **Centering (Letterboxing):**
   ```
   gameWidth = virtualWidth × scale
   gameHeight = virtualHeight × scale
   offsetX = (screenWidth - gameWidth) / 2   ← horizontal centering
   offsetY = (screenHeight - gameHeight) / 2  ← vertical centering
   ```

6. **Letterbox bars:** `LetterboxCalculator` computes the dimensions of the black bars (if any) around the game area.

7. **Safe areas:** `SafeAreaManager` reads CSS `env(safe-area-inset-*)` values to account for phone notches and rounded corners.

8. **DPR:** `DPRResolver` caps `devicePixelRatio` at 3× to prevent GPU overload on ultra-high-DPI screens.

#### AspectScaler — Scale Modes

| Mode | Behavior |
|------|----------|
| `contain` | Scale to fit entirely within bounds (may have letterbox bars) — **default** |
| `cover` | Scale to fill bounds completely (may crop edges) |
| `stretch` | Fill bounds exactly (distorts aspect ratio) — **never used for games** |

#### Coordinate Conversion

```typescript
// User taps at screen position (500, 300)
const virtual = viewportManager.screenToVirtual(500, 300);
// → { x: 960, y: 540 } (center of the virtual canvas)

// Place a sprite at virtual position (960, 540)
const screen = viewportManager.virtualToScreen(960, 540);
// → { x: 500, y: 300 } (where it appears on screen)
```

#### Viewport Events

When a resize or orientation change occurs, the EventBus emits:
- `'viewport:resize'` — New dimensions and scale
- `'viewport:breakpoint:changed'` — Breakpoint changed (e.g., desktop → mobile)

All presentation layers listen for these events and re-render accordingly.

---

### 10.5 Object Pooling — Deep Dive

**Path:** `src/runtime/pixi/pooling/`

#### The Problem

Slot games create and destroy **hundreds of sprites per spin**:
- 15–25 symbol sprites per grid
- Particle effects for wins
- Spine animation instances for celebrations
- FX containers for cascades

Creating `new Sprite()` and later garbage-collecting it causes **GC pauses** — visible as frame drops at 60fps.

#### The Solution: Object Pool

```typescript
class ObjectPool<T extends Poolable> {
  private pool: T[] = [];         // Available objects (returned to pool)
  private active: Set<T> = new Set();  // Currently in use
  private factory: () => T;       // How to create new objects

  acquire(): T | null;   // Get an object (from pool or factory)
  release(obj: T): void; // Return to pool (calls obj.reset())
  releaseAll(): void;    // Return all active objects
}
```

**`Poolable` interface:**
```typescript
interface Poolable {
  reset(): void;    // Reset to default state (clear position, alpha, texture, etc.)
  destroy?(): void; // Final cleanup when pool is destroyed
}
```

**How it works:**

```
1. Pool prewarmed with initialSize objects:
   pool: [sym1, sym2, sym3, ..., sym50]    active: {}

2. acquire() — takes sym50 from pool:
   pool: [sym1, sym2, ..., sym49]           active: {sym50}

3. Set texture, position, add to display tree

4. release(sym50) — sym50.reset() clears all state, returns to pool:
   pool: [sym1, sym2, ..., sym49, sym50]    active: {}
```

**Auto-expand:** If pool is empty and `autoExpand` is true, `acquire()` creates a new object via `factory()` (up to `maxSize`).

#### SymbolPool

Specialized pool for slot machine symbols:

```typescript
class PoolableSymbol implements Poolable {
  container: Container;  // Pixi container
  sprite: Sprite;        // Symbol texture sprite
  symbolId: string;      // Current symbol ('A', 'K', 'wild', etc.)
  row: number;           // Grid row
  col: number;           // Grid column

  reset(): void {
    this.symbolId = '';
    this.container.x = 0;
    this.container.y = 0;
    this.container.scale.set(1);
    this.container.alpha = 1;
    this.container.filters = null;
    this.sprite.texture = Texture.EMPTY;
    // Detach from parent
    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
  }
}
```

**Pool hierarchy:**

| Pool | Pre-warm | Max | Purpose |
|------|----------|-----|---------|
| `SymbolPool` | 50 | 200 | Reel symbol sprites |
| `SpinePool` | 5 | 50 | Spine animation instances |
| `FXPool` | 10 | 100 | Particle/effect containers |
| `ContainerPool` | 20 | 100 | Generic Pixi containers |
| `DisplayObjectPool` | 10 | 50 | Generic display objects |
| `ConfigurableSymbolPool` | 120 | - | Engine-managed, initialized by EngineKernel |

---

### 10.6 Asset Pipeline

**Path:** `src/runtime/pixi/assets/`

| File | Purpose |
|------|---------|
| `AssetPreloader.ts` | Orchestrates asset loading with progress, retry, and fallback |
| `AssetResolver.ts` | Resolves asset URLs from keys |
| `TextureCache.ts` | Singleton cache for loaded textures (by key) |
| `SpritesheetLoader.ts` | Loads sprite sheet JSON + image pairs |
| `AssetDisposer.ts` | Cleans up GPU resources when assets are no longer needed |
| `DefaultAssets.ts` | Procedural fallback assets (colored rectangles) when real assets fail to load |

**Loading flow:**
```
AssetPreloader.preload(config)
  ├── Load images → TextureCache
  ├── Load atlases → TextureCache
  ├── Load spritesheets → SpritesheetLoader → TextureCache
  ├── Load spine → SpineLoader → SpineFactory
  ├── Load audio → SoundManager
  ├── Load fonts → document.fonts.load()
  └── Emit 'assets:load:progress' per asset (for progress bar)
```

---

### 10.7 Spine Animation

**Path:** `src/runtime/pixi/spine/`

| File | Purpose |
|------|---------|
| `SpineLoader.ts` | Loads Spine JSON + atlas files |
| `SpineFactory.ts` | Creates Spine display object instances |
| `SpineAnimator.ts` | Controls Spine playback (play, pause, setAnimation, mixing) |

Spine animations are used for:
- Symbol win animations (e.g., a dragon breathing fire)
- Background ambient animations (e.g., floating particles)
- Feature intro animations (e.g., "Free Spins!" banner)

---

## 11. Presentation Layer — Visual Components

**Path:** `src/presentation/`

---

### 11.1 Layer System — Deep Dive (Z-Ordering)

The game's visual output is organized into **layers** stacked by z-index. Each layer is a `LayerContainer` (extends Pixi's `Container`) with a fixed `zIndex`.

```
Z-Order (bottom to top):

z=0     BackgroundLayer    — Full-screen game background (image, spine, or procedural)
z=100   DecorBackLayer     — Decorative elements behind the grid
z=200   TitleLayer         — Game title display
z=300   ScreenLayer        — Main game screen (grid, reels, symbols)
z=400   WinLayer           — Win celebration effects
z=500   FeatureLayer       — Feature-specific visuals (free spin banner)
z=600   PresentationLayer  — Win presentation overlays
z=700   TransitionLayer    — Screen transition effects (fade to black)
z=800   ToastLayer         — Notification toasts
z=900   OverlayLayer       — Modals, popups, big win celebrations
z=950   HUD                — In-canvas HUD (reserved, but HUD is React-based)
z=1000  DebugLayer         — FPS counter, state inspector (dev only)
```

**Why z-ordering?** Pixi.js renders children in order of `zIndex`. This ensures:
- Transitions always cover the game (z=700 > z=300)
- Debug info is always on top (z=1000)
- Win celebrations appear above the grid but below modals

---

### 11.2 StageRoot — The Display Tree

**File:** `src/runtime/pixi/stage/StageRoot.ts`

The `StageRoot` is the root `Container` of the entire Pixi display tree. It creates all 12 `LayerContainer`s during construction:

```typescript
class StageRoot extends BaseContainer {
  private layers: Map<StageLayer, LayerContainer>;

  constructor() {
    super({ name: 'StageRoot' });
    this.sortableChildren = true;
    this.initializeLayers(); // Creates all 12 layers
  }

  getLayer(type: StageLayer): LayerContainer;
  addToLayer(type: StageLayer, child: Container): void;
  removeFromLayer(type: StageLayer, child: Container): void;
  clearLayer(type: StageLayer): void;
  showLayer(type: StageLayer): void;
  hideLayer(type: StageLayer): void;
}
```

---

### 11.3 Individual Layers Explained

#### BackgroundLayer

**File:** `src/presentation/layers/BackgroundLayer.ts`

The most complex layer. It renders the game background using a **candidate-based system**:

1. **Config-driven:** Reads from `background.layer.json` in the game's config directory
2. **Multi-candidate rendering:** Each background is built from multiple candidates (spine + images can coexist), each in its own z-ordered sub-container
3. **Fallback chain:** Spine animation → Image texture → Procedural graphics (colored rectangle)
4. **Ambient effects:** Supports starfield generation, ambient spine animations (left/right/top/bottom glows), and overlay objects
5. **Responsive:** Re-renders on `'viewport:breakpoint:changed'` event

**Rendering priority per candidate:**
```
Config candidates → Try spine (if key loaded) → Try image (if texture cached) → Skip
If zero candidates rendered → Draw procedural fallback (dark background + colored glows)
```

#### ScreenLayer

Holds the current game screen (e.g., `BaseScreen` with the grid and reels). Only one screen at a time.

#### TransitionLayer

Full-screen black rectangle that fades in/out for screen transitions. Config-driven fade durations and colors.

```typescript
await transitionLayer.fadeIn(200);   // Fade to black in 200ms
// ... switch screen ...
await transitionLayer.fadeOut(200);  // Fade back to transparent
```

Uses GSAP (`TweenFactory.to()`) for smooth alpha interpolation.

---

### 11.4 Screen System

**Path:** `src/presentation/screens/`

| File | Purpose |
|------|---------|
| `ScreenManager.ts` | Manages screen lifecycle and transitions between screens |
| `ScreenBase.ts` | Abstract base class for all screens |
| `ScreenLifecycle.ts` | Lifecycle hooks: `onInit`, `onEnter`, `onExit`, `onPause`, `onResume`, `onUpdate`, `onDestroy` |
| `base/BaseScreen.ts` | The main game screen (contains the grid/reels) |

**Screen lifecycle:**
```
UNINITIALIZED → init() → READY → enter() → ACTIVE ↔ PAUSED → exit() → READY → destroy() → DESTROYED
```

**Screen switching:**
```typescript
await screenManager.switchTo('BaseScreen', true); // true = with transition
// 1. TransitionLayer.fadeIn(200ms)
// 2. Current screen.exit()
// 3. ScreenLayer.clearScreen()
// 4. New screen.enter()
// 5. ScreenLayer.setScreen(newScreen)
// 6. TransitionLayer.fadeOut(200ms)
```

---

### 11.5 Grid System

**Path:** `src/presentation/grid/`

| File | Purpose |
|------|---------|
| `GridManager.ts` | Master grid controller — creates/manages grid, dispatches updates |
| `GridContainer.ts` | Pixi container holding all reel columns |
| `GridCoordinateMapper.ts` | Maps grid positions (row, col) to pixel coordinates |
| `GridLayoutApplier.ts` | Applies responsive layout positions from config |
| `GridMask.ts` | Masks the grid area to hide symbols scrolling outside bounds |
| `GridSlots.ts` | Manages individual symbol slots in the grid |
| `reels/` | Reel column containers and spin animations |
| `symbols/` | Symbol sprite rendering, texture resolution, `ConfigurableSymbolPool` |
| `frame/` | Grid frame/border visuals |
| `fx/` | Grid-level visual effects |

---

### 11.6 Win Presentation

**Path:** `src/presentation/win/`

| File | Purpose |
|------|---------|
| `LineHighlightContainer.ts` | Highlights winning paylines with animated lines |
| `WaysHighlightContainer.ts` | Highlights winning ways (adjacent reel matches) |
| `WinCounter.ts` | Animated win amount counter (rolls up from 0 to win amount) |
| `WinTextContainer.ts` | "Big Win!", "Mega Win!" text displays |

---

### 11.7 Cascade Presentation

**Path:** `src/presentation/cascade/`

Handles the visual phases of a cascade/tumble game:

| File | Purpose |
|------|---------|
| `CascadePresenter.ts` | Orchestrates cascade visual sequence |
| `CascadePhaseHandlerImpl.ts` | Implements each cascade phase: removal → collapse → refill |
| `CascadeConfigResolver.ts` | Reads cascade timings from config |
| `CascadeConfigTypes.ts` | Type definitions for cascade config |
| `CascadeDataTypes.ts` | Types for cascade step data |

**Cascade visual sequence (per step):**
```
1. Win Presentation (500ms)   — Highlight winning symbols
2. Removal (350ms)            — Winning symbols disappear (fade/explode)
3. Collapse (400ms)           — Remaining symbols fall down to fill gaps
4. Refill (350ms)             — New symbols drop in from above
5. Inter-step delay (200ms)   — Brief pause before next cascade step
```

All timings are config-driven via `TimingProvider`.

---

### 11.8 Transition System

**Path:** `src/presentation/transitions/`

| File | Purpose |
|------|---------|
| `TransitionController.ts` | Manages transition execution |
| `FadeTransition.ts` | Simple alpha fade |
| `SlideTransition.ts` | Slide in/out from edges |
| `PortalTransition.ts` | Circular reveal/conceal effect |
| `ZoomTransition.ts` | Zoom in/out with fade |

---

## 12. UI Layer — React Overlay

**Path:** `src/ui/`

React components rendered as an HTML/CSS overlay on top of the Pixi canvas.

| Directory | Purpose |
|-----------|---------|
| `controls/` | Spin button, autoplay controls, turbo toggle |
| `hud/` | Balance display, bet selector, win amount |
| `lobby/` | Game selection grid with game cards |
| `modals/` | Paytable, settings, rules, history |
| `overlays/` | Full-screen overlays (loading, disconnected) |
| `settings/` | Audio, quality, language settings |
| `shell/` | App chrome, navigation, toolbar |
| `hooks/` | `useEngine`, `useGameState`, `useBalance`, etc. |
| `providers/` | `EngineProvider`, `ThemeProvider` |

### React ↔ Engine Bridge

React communicates with the engine exclusively through:

1. **`useEngine()` hook** — Provides access to `EngineKernel` methods
2. **EventBus subscriptions** — React hooks subscribe for reactive updates:
   ```typescript
   useEffect(() => {
     const id = eventBus.on('wallet:balance:update', (payload) => {
       setBalance(payload.newBalance);
     });
     return () => eventBus.off(id);
   }, []);
   ```
3. **Emitting events** — UI actions emit events:
   ```typescript
   onClick={() => eventBus.emit('game:spin:request', { bet, lines })}
   ```

**Why React for UI?**
- Accessibility (ARIA, keyboard navigation) comes free with Radix primitives
- Responsive layouts are trivial with Tailwind
- Hot module reloading for rapid UI iteration
- Canvas-rendered UIs are harder to make accessible and responsive

---

## 13. Configuration System

### 13.1 Structure

```
public/game-configs/
├── shared/                          # Shared defaults
│   ├── config.global.json           # Global settings
│   ├── defaults.json                # Default game values
│   ├── timings.json                 # Animation timings (shared)
│   ├── symbol-rendering.defaults.json
│   ├── features/                    # Shared feature configs
│   ├── hud/                         # HUD layout config
│   └── layers/                      # Default layer configs (background, transition, etc.)
└── games/
    ├── dragon-fortune/
    │   ├── manifest.json            # Game-specific config
    │   ├── network.json             # Network adapter config
    │   └── timings.json             # Game-specific timing overrides
    ├── neon-nights/
    │   ├── manifest.json
    │   ├── network.json
    │   └── timings.json
    └── egyptian-adventure/
        ├── manifest.json
        └── network.json
```

### 13.2 Config Merging Priority

```
Game-specific config  >  Shared defaults  >  Hardcoded fallbacks
```

### 13.3 Game Manifest

Each game's `manifest.json` defines:
- **Grid:** Rows, columns, symbol set
- **Spin strategy:** Which mechanic to use (standard, cascade, megaways)
- **Win system:** How wins are evaluated (paylines, ways, cluster)
- **Features:** Which features are enabled (freeSpins, stickyWilds, etc.)
- **Paytable:** Symbol values and multipliers
- **Assets:** Textures, spine animations, audio files with bundle priorities
- **Responsive layouts:** Per-breakpoint virtual dimensions and element positioning
- **Loading config:** Asset fallback behavior, required bundles, retry policy

---

## 14. EventBus Communication Flows

### 14.1 How Wiring Works

Components wire themselves to the EventBus during initialization. They never reference each other directly.

```
┌──────────┐     emit('game:spin:start')     ┌───────────┐
│   UI     │ ──────────────────────────────→  │  EventBus │
│ Controls │                                  │           │
└──────────┘                                  │  Routes   │
                                              │  to all   │
┌──────────┐     on('game:spin:start')        │subscribers│
│  Audio   │ ←──────────────────────────────  │           │
│Controller│                                  │           │
└──────────┘                                  │           │
┌──────────┐     on('game:spin:start')        │           │
│  Flow    │ ←──────────────────────────────  │           │
│  System  │                                  │           │
└──────────┘                                  │           │
┌──────────┐     on('game:spin:start')        │           │
│ Network  │ ←──────────────────────────────  │           │
│ Manager  │                                  └───────────┘
└──────────┘
```

**Key principle:** The UI doesn't know `AudioController` exists. `AudioController` doesn't know the UI exists. They only know about the EventBus and the events they care about.

### 14.2 Event Categories

| Category | Prefix | Examples |
|----------|--------|---------|
| Engine lifecycle | `engine:` | `engine:ready`, `engine:pause`, `engine:error` |
| Game actions | `game:` | `game:spin:start`, `game:spin:result`, `game:spin:complete` |
| Feature lifecycle | `feature:` | `feature:triggered`, `feature:start`, `feature:end` |
| UI interactions | `ui:` | `ui:bet:change`, `ui:button:press`, `ui:turbo:changed` |
| Network | `network:` | `network:request`, `network:response`, `network:error` |
| Wallet | `wallet:` | `wallet:balance:update` |
| Audio | `sound:` / `music:` | `sound:play`, `music:change` |
| Assets | `assets:` | `assets:load:start`, `assets:load:progress`, `assets:load:complete` |
| Viewport | `viewport:` | `viewport:resize`, `viewport:breakpoint:changed` |
| Session | `session:` | `session:initialized`, `session:ready` |
| Round | `round:` | `round:started`, `round:result`, `round:complete` |
| Cascade | `cascade:` | `cascade:start`, `cascade:step:start`, `cascade:complete` |
| Free Spins | `freespins:` | `freespins:trigger`, `freespins:spin:start` |
| Config | `config:` | `config:loaded` |
| Loading | `game:loading:` | `game:loading:progress` |

### 14.3 Complete Spin Event Flow

```
User clicks SPIN
    │
    ▼
'game:spin:request' { bet: 10, lines: 1024 }
    │
    ├──→ GameController validates → deducts bet
    │
    ▼
'wallet:balance:update' { previousBalance: 1000, newBalance: 990, change: -10 }
    │
    ├──→ HUD updates balance display
    │
    ▼
'game:spin:start' { bet: 10 }
    │
    ├──→ SpinLoop starts reel animations
    ├──→ AudioController plays spin sound
    ├──→ FlowSystem starts SPIN flow
    ├──→ UI disables spin button
    │
    ▼
[Server processes spin request...]
    │
    ▼
'game:spin:result' { roundId, symbols[][], wins[], totalWin, features[] }
    │
    ├──→ SpinLoop receives final symbols
    ├──→ GridManager prepares to display result
    │
    ▼
'reel:spin:stop' { reelIndex: 0, symbols: [...] }   (per reel, staggered)
'reel:spin:stop' { reelIndex: 1, symbols: [...] }
'reel:spin:stop' { reelIndex: 2, symbols: [...] }
...
    │
    ▼
'game:reels:stopped' { symbols[][] }
    │
    ├──→ ResultPresentationController begins step presentation
    │
    ▼
[For each step: RESULT, CASCADE, etc.]
    │
    ├──→ 'cascade:step:start' (if cascade game)
    ├──→ Win highlights shown (LineHighlightContainer / WaysHighlightContainer)
    ├──→ 'cascade:step:complete'
    │
    ▼
'wallet:balance:update' { newBalance: 1025 }  (server-authoritative final balance)
    │
    ▼
'game:spin:complete' { roundId, totalWin: 35, duration: 3200 }
    │
    ├──→ FlowSystem completes SPIN flow
    ├──→ AudioController plays idle music
    ├──→ UI re-enables spin button
    └──→ State → IDLE
```

### 14.4 Priority-Based Dispatch

Handlers with higher priority execute first:

```typescript
// Priority 100 — Validation runs FIRST
eventBus.on('game:spin:start', validateBalance, 100);

// Priority 0 (default) — Normal handlers
eventBus.on('game:spin:start', playSpinSound);

// Priority -10 — Analytics runs LAST
eventBus.on('game:spin:start', logAnalytics, -10);
```

A validation handler can call `envelope.stopPropagation()` to prevent lower-priority handlers from running — effectively canceling the spin before audio plays or reels start.

### 14.5 Event Queueing During Processing

If an event handler emits another event *during* event processing, the new event is **queued** and processed after the current event's handlers all complete:

```
emit('game:spin:result')
  → handler A processes result, emits 'wallet:balance:update'  ← QUEUED
  → handler B processes result, emits 'cascade:start'          ← QUEUED
  → all handlers for 'game:spin:result' complete
→ now process 'wallet:balance:update' (all its handlers)
→ now process 'cascade:start' (all its handlers)
```

**Why?** Prevents stack overflow from recursive event chains and ensures deterministic handler ordering.

---

## 15. Full Lifecycle Flow

### Phase 1: Application Boot
```
1. Vite loads main.tsx
2. React renders App.tsx → Providers.tsx → Router.tsx
3. Router renders LobbyPage at "/"
4. LobbyPage displays available game cards (fetched from config)
```

### Phase 2: Game Selection
```
1. User clicks a game card (e.g., "Neon Nights")
2. React Router navigates to /game/neon-nights
3. GamePageWithSession validates session via SessionTokenManager
4. GamePage mounts EngineProvider
```

### Phase 3: Engine Initialization (see Section 7.2 for full detail)
```
1. EngineProvider creates EngineKernel singleton
2. EngineKernel.initialize() runs 17-step sequence
3. EventBus emits 'engine:ready'
4. UI shows the game
```

### Phase 4: Gameplay (Spin Cycle)
```
1. User adjusts bet via UI → emits 'ui:bet:change'
2. User clicks SPIN → emits 'game:spin:request'
3. Full event flow (see Section 14.3)
4. Round completes → state returns to IDLE
```

### Phase 5: Feature Trigger (e.g., Free Spins)
```
1. Server response includes featuresTriggered: ['freeSpins']
2. GameController emits 'feature:triggered'
3. EngineKernel listens → swaps spin strategy to feature-specific one
4. FreeSpinFeature activates
5. State → FEATURE
6. Free spin rounds play automatically
7. Feature completes → emits 'feature:end'
8. EngineKernel restores base game spin strategy
9. State → IDLE
```

### Phase 6: Cleanup (Navigation Away or Tab Close)
```
1. User navigates away (or closes tab)
2. EngineKernel.destroy() called
3. All subsystems destroyed in reverse initialization order:
   AudioController → AudioManager → TickManager → GameController →
   PresentationOrchestrator → SymbolPool → ScreenManager →
   StageManager → PixiManager → ConfigLoader → GameLoader →
   NetworkManager → EventBus
4. All singleton instances reset to null (prevents stale state on re-mount)
```

---

## 16. Network Architecture

### 16.1 API Protocol

All requests follow a standard envelope:

```typescript
interface GameRequest {
  type: 'gameLaunch' | 'spin' | 'featureAction' | 'buyBonus';
  meta: { requestId, timestamp, clientVersion };
  auth: { sessionToken };
  data: { ... };  // type-specific payload
}
```

### 16.2 Mock Server

The `MockGameServer` simulates full server-side logic for development:
- Random matrix generation with configurable symbol weights
- Paytable-based win evaluation
- Feature trigger logic (scatter count → free spins)
- Balance management (deduct bet, add wins)
- Cascade step generation (removal → new symbols → re-evaluation)

---

## 17. Extending the Framework

### 17.1 Adding a New Game (Zero Code Changes)

1. Create `public/game-configs/games/<game-id>/manifest.json`
2. Create `public/game-configs/games/<game-id>/network.json`
3. Add game assets to `public/assets/games/<game-id>/`
4. Add a game card in `LobbyPage`
5. **Zero code changes** to engine, modules, or gameplay layers.

### 17.2 Adding a New Spin Strategy

1. Create `src/modules/mechanics/<name>/<Name>SpinStrategy.ts`
2. Extend `SlotPlugin` or implement `ISpinStrategy`
3. Register in `ModuleRegistry.registerSpinStrategies()`:
   ```typescript
   registry.register('myStrategy', (config) => new MySpinStrategy(config));
   ```
4. Reference in game manifest: `{ "spinStrategy": "myStrategy" }`

### 17.3 Adding a New Feature

1. Create `src/modules/features/<name>/<Name>Feature.ts`
2. Extend `SlotPlugin`
3. Subscribe to relevant events in `onEnable()`
4. Register in `ModuleRegistry.registerFeatures()`:
   ```typescript
   this.featureInstances.set('myFeature', new MyFeature());
   ```
5. Enable in game manifest: `{ "features": ["myFeature"] }`

### 17.4 Adding New Events

1. Add payload interface to `src/platform/events/EventMap.ts`
2. Add event type to the `EventMap` interface mapping
3. All existing `EventBus` type checking will automatically enforce the new payload

### 17.5 Adding a New Layer

1. Create `src/presentation/layers/MyLayer.ts`
2. Extend `LayerContainer`
3. Add a new `StageLayer` enum value in `StageRoot.ts` with desired z-index
4. Instantiate and add to `StageRoot` in `EngineKernel.composeLayers()`

### 17.6 Adding New Timings

1. Add the key to `shared/timings.json` (default value)
2. Override per-game in `games/<id>/timings.json`
3. Read via `timingProvider.getMs('my.new.timing')` — turbo mode automatically applies

---

## 18. Design Decisions & Rationale

### Why Singleton Pattern?
Most engine services use the singleton pattern because:
- **One engine per tab:** There is exactly one game engine instance per browser tab
- **Cross-framework access:** Services must be accessible from both React components and non-React code (Pixi containers, audio, timeline actions)
- **Reset on destroy:** All singletons are set to `null` on `destroy()` — no stale state between game sessions

### Why EventBus over Direct Calls?
- **Decoupling:** AudioController doesn't know GameController exists (and vice versa)
- **Extensibility:** Adding a new listener requires zero changes to existing code
- **Debugging:** EventHistory provides a complete audit trail of what happened
- **Testing:** Events can be intercepted, recorded, and replayed in isolation
- **Replay:** The entire game can be replayed by re-emitting recorded events

### Why Pixi.js + React (Dual Rendering)?
- **Pixi.js** excels at GPU-accelerated 2D rendering at 60fps (symbols, particles, spine)
- **React** excels at UI (forms, modals, tooltips, accessibility, responsive layout)
- **Alternative (canvas-only):** Would sacrifice accessibility and make responsive UI extremely difficult
- **Alternative (DOM-only):** Cannot achieve 60fps with hundreds of animated sprites

### Why Config-Driven?
- **Operator customization:** Different casinos configure bet limits, features, payouts per jurisdiction
- **A/B testing:** Test different configurations without code deploys
- **Rapid iteration:** Designers tweak timings, sizes, animations via JSON
- **Multi-game support:** One codebase powers multiple games with different configs

### Why Server-Authoritative?
- **Regulatory compliance:** Gambling regulators require certified server-side RNG
- **Cheat prevention:** Client never calculates wins; it only presents them
- **Consistency:** All players experience the same mathematical model regardless of client version

### Why Adapter Pattern for Networking?
- **Development speed:** MockAdapter enables offline development with zero server dependency
- **Testing flexibility:** Switch to REST for integration tests
- **Production readiness:** STOMP for real-time WebSocket connections
- **Runtime switching:** Failover from STOMP → REST on WebSocket failure

### Why Object Pooling?
- **GC prevention:** Slot games create/destroy hundreds of sprites per spin. Without pooling, GC pauses cause visible frame drops
- **Stable memory:** Pool size is bounded — memory usage is predictable
- **Performance:** `pool.acquire()` is O(1) vs `new Sprite()` which triggers allocation + constructor

### Why Timeline System (not just Promises)?
- **Cancellation:** Player can skip win presentations. Promises don't support cancellation; `CancellationToken` does
- **Progress tracking:** Timeline reports 0.0–1.0 progress for progress bars
- **Composition:** Parallel, Loop, Conditional actions compose naturally
- **Error boundaries:** Two-level error handling prevents zombie timelines

### Why Isolated Replay Bus?
- **Safety:** Replaying events on the live EventBus would trigger real network requests, modify balance, and corrupt game state
- **Independence:** Replay can run at any speed without affecting the live game
- **Testing:** QA can replay sessions without a server connection

---

## 19. Glossary

| Term | Definition |
|------|-----------|
| **BaseGame** | The primary game mode where normal spins occur |
| **Breakpoint** | A responsive layout threshold (desktop, mobile-landscape, mobile-portrait) |
| **CancellationToken** | Mechanism for safely aborting long-running timeline actions |
| **Cascade/Tumble** | Winning symbols are removed and new ones fall in, allowing chain wins |
| **DPR** | Device Pixel Ratio — how many physical pixels per CSS pixel (1× on standard, 2× on Retina) |
| **EventBus** | Central pub/sub system for typed inter-component communication |
| **EventEnvelope** | Metadata wrapper around each event (timestamp, sequence, hash) |
| **Feature** | A special game mode triggered during play (Free Spins, Bonus, Hold & Respin) |
| **FlowSystem** | Manages the sequence of steps within a game round |
| **GameController** | Main game loop — handles spin requests and result presentation |
| **Grid/Matrix** | The 2D array of symbols displayed on the reels |
| **HUD** | Heads-Up Display — balance, bet, win counters (React-based) |
| **Kernel** | The central engine orchestrator that initializes and manages all subsystems |
| **Letterboxing** | Black bars shown when game aspect ratio doesn't match screen |
| **Manifest** | Per-game JSON configuration defining all game parameters |
| **Mechanism** | A pluggable spin-flow behavior (Hold & Respin, Lock Sequence, etc.) |
| **MockAdapter** | In-memory network adapter that simulates server responses |
| **ObjectPool** | Pre-created object cache to avoid runtime allocations and GC pauses |
| **Payline** | A predefined line across the grid where matching symbols create a win |
| **Paytable** | Lookup table defining symbol combination values |
| **Plugin** | A modular game component (feature, win system, mechanic) extending `SlotPlugin` |
| **Poolable** | Interface requiring `reset()` — objects must be resettable for pool recycling |
| **Reel** | A vertical column of symbols that spins |
| **RNG** | Random Number Generator — determines spin outcomes (server-side only) |
| **Round** | One complete spin cycle: request → result → presentation → complete |
| **Safe Area** | Screen region free from notches and system UI (CSS `env(safe-area-inset-*)`) |
| **Session** | A player's active connection to a game, persisted across page refreshes |
| **Spin Strategy** | Defines how reels animate (top-to-bottom, cascade, megaways, etc.) |
| **Stage** | The Pixi.js display tree containing all visual layers |
| **StageRoot** | Root container with 12 z-ordered `LayerContainer`s |
| **Step** | One sub-result within a round (e.g., initial RESULT, CASCADE step 1, step 2) |
| **TickManager** | Distributes frame ticks to registered listeners (grid, screen) |
| **Timeline** | Declarative action sequence (delay → parallel → loop → conditional) |
| **TimingProvider** | Config-driven timing values, auto-divided by turbo multiplier |
| **TurboState** | Singleton tracking turbo mode on/off and speed multiplier |
| **Virtual Dimensions** | The design-time resolution the game targets (e.g., 1920×1080) |
| **Ways** | A win system where matching symbols on adjacent reels create wins (no fixed lines) |
| **Wild** | A symbol that substitutes for other symbols to form wins |

---

## 20. Appendix A: Complete File Index

### Platform (`src/platform/`)
```
events/EventBus.ts              — Typed pub/sub backbone with priority dispatch
events/EventMap.ts              — 800+ lines of typed event contracts
events/EventEnvelope.ts         — Event metadata: id, sequence, timestamp, hash, propagation control
events/EventHistory.ts          — Circular buffer recording recent events
events/EventScheduler.ts        — Delayed/repeating event scheduling
events/EventTimeline.ts         — Debug timeline recording with relative timestamps
events/EventTracker.ts          — Event frequency and handler performance monitoring
networking/NetworkManager.ts    — Adapter-based network layer
networking/INetworkAdapter.ts   — Adapter interface
networking/RestAdapter.ts       — HTTP adapter (fetch)
networking/StompAdapter.ts      — WebSocket adapter
networking/MockAdapter.ts       — Development mock
networking/MockGameServer.ts    — Full simulated game server (RNG, paytable, cascades)
networking/SessionTokenManager.ts — Session persistence (localStorage)
networking/APIProtocol.ts       — Request/response types
networking/PayloadMapper.ts     — Server → client mapping
networking/PayloadValidator.ts  — Response validation
networking/RetryPolicy.ts       — Exponential backoff retry
audio/AudioBus.ts               — Audio event routing
audio/AudioRegistry.ts          — Sound registry
audio/SoundManager.ts           — Howler.js wrapper
localization/LocaleManager.ts   — i18n management
localization/LocaleResolver.ts  — Locale detection
localization/LanguagePack.ts    — Language pack loader
logger/Logger.ts                — Named logger instances
logger/LogLevel.ts              — Log levels
logger/LogFormatter.ts          — Structured formatting
logger/LoggerController.ts      — Global log level control
logger/transports/              — Console, remote, buffer transports
```

### Engine (`src/engine/`)
```
core/EngineKernel.ts            — Central orchestrator (17-step initialization)
core/EngineStateMachine.ts      — FSM with guarded transitions
core/GameLoader.ts              — 6-phase loading with weighted progress
core/EngineLifecycle.ts         — Lifecycle hooks
core/EngineMode.ts              — Game mode definitions
core/EngineGuards.ts            — Transition guard conditions
core/SlotEngine.ts              — Legacy engine wrapper
flow/FlowSystem.ts              — Round sequence management
flow/FlowTypes.ts               — Flow type enums
flow/FlowEvents.ts              — Flow event definitions
plugin/SlotPlugin.ts            — Abstract plugin base class
plugin/PluginRegistry.ts        — Registry with priority + dependency resolution
plugin/PluginDependencyGraph.ts — Topological sort for load order
plugin/PluginResolver.ts        — Plugin instance lookup
audio/AudioManager.ts           — Channel management, focus handling
audio/AudioController.ts        — EventBus → audio mapping per game
audio/AudioChannel.ts           — Named channels with independent volume
audio/AudioConfigResolver.ts    — Audio config from game JSON
audio/AudioEventBus.ts          — Audio-specific event routing
audio/AudioSpriteLoader.ts      — Audio sprite sheet loading
data/DataStore.ts               — Key-value game data store
data/DataHydrator.ts            — State reconstruction
data/DataSerializer.ts          — State serialization
data/DataSnapshot.ts            — Point-in-time state captures
```

### Runtime (`src/runtime/pixi/`)
```
core/PixiApplicationManager.ts  — High-level Pixi subsystem coordinator
core/PixiRuntime.ts             — Pixi Application instance, canvas, renderer
core/PixiTicker.ts              — Priority-based game loop with time scaling
core/PixiClock.ts               — High-precision game clock (performance.now)
core/PixiRendererFactory.ts     — WebGL renderer creation
core/PixiDisposer.ts            — GPU resource cleanup
core/PixiMemoryTracker.ts       — Memory usage monitoring
core/PixiPerformanceMonitor.ts  — FPS and render time tracking
core/VirtualDims.ts             — Virtual dimension helpers
viewport/ViewportManager.ts     — Central viewport state and coordinate conversion
viewport/AspectScaler.ts        — Contain/cover/stretch calculations
viewport/ResizeObserver.ts      — Debounced DOM resize detection
viewport/OrientationObserver.ts — Portrait/landscape detection
viewport/LetterboxCalculator.ts — Letterbox bar dimensions
viewport/DPRResolver.ts         — Device pixel ratio management
viewport/SafeAreaManager.ts     — Notch/safe-area-inset detection
stage/StageManager.ts           — Display tree root management
stage/StageRoot.ts              — 12 z-ordered LayerContainers
containers/BaseContainer.ts     — Base Pixi container wrapper
containers/LayerContainer.ts    — Z-indexed layer container
pooling/ObjectPool.ts           — Generic object pool (acquire/release/reset)
pooling/SymbolPool.ts           — Specialized pool for slot symbols
pooling/SpinePool.ts            — Pool for Spine animation instances
pooling/FXPool.ts               — Pool for particle/effect containers
pooling/ContainerPool.ts        — Pool for generic Pixi containers
pooling/DisplayObjectPool.ts    — Pool for generic display objects
assets/AssetPreloader.ts        — Asset loading with progress and fallback
assets/TextureCache.ts          — Texture cache (singleton)
assets/SpritesheetLoader.ts     — Sprite sheet loading
assets/AssetResolver.ts         — URL resolution
assets/AssetDisposer.ts         — GPU resource cleanup
assets/DefaultAssets.ts         — Procedural fallback assets
spine/SpineLoader.ts            — Spine JSON + atlas loading
spine/SpineFactory.ts           — Spine instance creation
spine/SpineAnimator.ts          — Spine playback control
factory/PixiFactory.ts          — Display object factories
animation/                      — TweenFactory (GSAP), presets, filters
```

### Gameplay (`src/gameplay/`)
```
engine/GameController.ts        — Main game loop (spin request → result → presentation)
engine/SpinLoop.ts              — Reel spin timing and visual control
engine/PresentationOrchestrator.ts — Win presentation coordination
engine/ResultPresentationController.ts — Step-by-step result presentation
engine/StepSequencePresenter.ts — Individual step presentation
engine/FlowOrchestrator.ts      — Higher-level flow coordination
engine/GameClock.ts             — Game-relative time
engine/TickManager.ts           — Frame tick distribution
engine/PauseManager.ts          — Pause/resume logic
engine/VisibilityManager.ts     — Browser tab visibility handling
engine/Scheduler.ts             — Delayed action scheduling
state/GameSession.ts            — Master session aggregator
state/RoundState.ts             — Current round data
state/WalletState.ts            — Balance, bet, currency
state/FeatureState.ts           — Active feature tracking
state/StateSerializer.ts        — Session persistence
timeline/TimelineRunner.ts      — Timeline execution engine (pause/resume/skip/loop)
timeline/SequenceBuilder.ts     — Fluent builder API
timeline/DelayAction.ts         — Cancellable delay
timeline/ParallelAction.ts      — Promise.all() for actions
timeline/LoopAction.ts          — Repeat N times
timeline/ConditionalAction.ts   — Runtime branching
timeline/TimelineTypes.ts       — CancellationToken, action interfaces
timing/TimingProvider.ts        — Config-driven timings with turbo support
timing/TurboState.ts            — Turbo mode singleton
replay/ReplayRecorder.ts        — Event recording with integrity hashes
replay/ReplayPlayer.ts          — Isolated playback on shadow EventBus
models/                         — Domain models (Game, Round, Wallet, User, Feature)
evaluation/                     — Win evaluation helpers
```

### Presentation (`src/presentation/`)
```
layers/BackgroundLayer.ts       — Config-driven background (spine/image/procedural)
layers/TitleLayer.ts            — Game title display
layers/ScreenLayer.ts           — Current screen container
layers/TransitionLayer.ts       — Fade transitions (GSAP-powered)
layers/ToastLayer.ts            — Notification toasts
layers/OverlayLayer.ts          — Modals, popups
layers/DebugLayer.ts            — FPS counter, state inspector
layers/WinLayer.ts              — Win celebration effects
layers/FeatureLayer.ts          — Feature-specific visuals
layers/PresentationLayer.ts     — Win presentation overlays
layers/DecorBackLayer.ts        — Decorative elements
layers/config/LayerConfigManager.ts — Layer config loading/merging
layers/base/                    — Base layer classes
screens/ScreenManager.ts        — Screen lifecycle and transitions
screens/ScreenBase.ts           — Abstract screen base
screens/ScreenLifecycle.ts      — Lifecycle hooks and state enum
screens/base/BaseScreen.ts      — Main game screen (grid + reels)
grid/GridManager.ts             — Master grid controller
grid/GridContainer.ts           — Grid Pixi container
grid/GridCoordinateMapper.ts    — Grid position → pixel mapping
grid/GridLayoutApplier.ts       — Responsive layout application
grid/GridMask.ts                — Grid area masking
grid/GridSlots.ts               — Individual symbol slot management
grid/reels/                     — Reel columns and spin animations
grid/symbols/                   — Symbol rendering, ConfigurableSymbolPool
grid/frame/                     — Grid frame/border
grid/fx/                        — Grid visual effects
win/LineHighlightContainer.ts   — Payline win highlights
win/WaysHighlightContainer.ts   — Ways win highlights
win/WinCounter.ts               — Animated win amount counter
win/WinTextContainer.ts         — Big Win / Mega Win text
cascade/CascadePresenter.ts     — Cascade visual orchestration
cascade/CascadePhaseHandlerImpl.ts — Removal/collapse/refill phases
transitions/TransitionController.ts — Transition management
transitions/FadeTransition.ts   — Alpha fade
transitions/SlideTransition.ts  — Slide in/out
transitions/PortalTransition.ts — Circular reveal
transitions/ZoomTransition.ts   — Zoom with fade
hud/                            — In-canvas HUD elements
```

---

*End of Document*

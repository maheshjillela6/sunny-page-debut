# Slot Game Framework — Technical Architecture Document

> **Version:** 1.0  
> **Last Updated:** 2026-02-19  
> **Audience:** Developers, architects, and anyone working on or extending this framework.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure Overview](#3-project-structure-overview)
4. [Architectural Layers](#4-architectural-layers)
5. [Bootstrap & Application Shell](#5-bootstrap--application-shell)
6. [Platform Layer — Infrastructure Services](#6-platform-layer--infrastructure-services)
7. [Engine Layer — The Brain](#7-engine-layer--the-brain)
8. [Module System — Pluggable Game Mechanics](#8-module-system--pluggable-game-mechanics)
9. [Gameplay Layer — Game Logic & Orchestration](#9-gameplay-layer--game-logic--orchestration)
10. [Runtime Layer — Pixi.js Rendering](#10-runtime-layer--pixijs-rendering)
11. [Presentation Layer — Visual Components](#11-presentation-layer--visual-components)
12. [UI Layer — React Overlay](#12-ui-layer--react-overlay)
13. [Configuration System](#13-configuration-system)
14. [EventBus — Communication Backbone](#14-eventbus--communication-backbone)
15. [Full Lifecycle Flow: Lobby → Game Launch → Spin → Win](#15-full-lifecycle-flow-lobby--game-launch--spin--win)
16. [Network Architecture](#16-network-architecture)
17. [Plugin System](#17-plugin-system)
18. [State Management](#18-state-management)
19. [Audio System](#19-audio-system)
20. [Extending the Framework](#20-extending-the-framework)
21. [Design Decisions & Rationale](#21-design-decisions--rationale)
22. [Glossary](#22-glossary)

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

| Layer | Technology | Why |
|-------|-----------|-----|
| **Language** | TypeScript | Type safety, IDE support, catch errors at compile time |
| **Build Tool** | Vite | Fast HMR, ESM-native, small bundle size |
| **Game Rendering** | Pixi.js v8 | Industry-standard 2D WebGL renderer, 60fps, GPU-accelerated |
| **Skeletal Animation** | Spine (pixi-spine) | Rich character/symbol animations from artist tools |
| **Animation Tweens** | GSAP + Framer Motion | GSAP for canvas tweens, Framer Motion for React UI animations |
| **UI Framework** | React 18 | Component model for HUD/controls overlay |
| **Styling** | Tailwind CSS | Utility-first, rapid UI development |
| **UI Components** | shadcn/ui (Radix) | Accessible, composable primitives |
| **Audio** | Howler.js | Cross-browser audio with sprites, pooling, volume control |
| **State** | Singleton services + EventBus | Predictable state flow without Redux overhead |
| **Routing** | React Router v6 | Lobby → Game navigation with session persistence |

---

## 3. Project Structure Overview

```
src/
├── bootstrap/           # App shell: entry point, routing, providers
├── platform/            # Infrastructure: EventBus, networking, audio, i18n, logging
├── engine/              # Core engine: kernel, state machine, flow, plugins, audio
├── modules/             # Pluggable game modules: mechanics, features, win systems
├── gameplay/            # Game logic: controller, state, models, timeline, replay
├── runtime/             # Pixi.js runtime: app manager, ticker, animations, pooling
├── presentation/        # Visual components: grid, win animations, screens, layers
├── ui/                  # React UI overlay: HUD, controls, lobby, modals, settings
├── config/              # Environment and build configuration
├── content/             # Game config loader and content management
├── test/                # Test utilities
└── pages/               # Top-level page components

public/
└── game-configs/        # Per-game JSON configuration files
    ├── shared/           # Shared defaults (timings, HUD layout, features)
    └── games/            # Per-game configs (dragon-fortune, neon-nights, etc.)
        └── <game-id>/    # manifest.json, network.json, assets config
```

---

## 4. Architectural Layers

The framework is organized into distinct layers, each with a clear responsibility. Dependencies flow downward — upper layers depend on lower ones, never the reverse.

```
┌─────────────────────────────────────────────────┐
│                  UI Layer (React)                │  ← HUD, Controls, Modals
│                  src/ui/                         │
├─────────────────────────────────────────────────┤
│             Presentation Layer (Pixi)           │  ← Grid, Win Animations, Screens
│             src/presentation/                   │
├─────────────────────────────────────────────────┤
│              Gameplay Layer                     │  ← GameController, State, Timeline
│              src/gameplay/                      │
├─────────────────────────────────────────────────┤
│              Module System                      │  ← Spin Strategies, Features, Win Systems
│              src/modules/                       │
├─────────────────────────────────────────────────┤
│              Engine Layer                       │  ← Kernel, StateMachine, Flow, Plugins
│              src/engine/                        │
├─────────────────────────────────────────────────┤
│              Runtime Layer                      │  ← PixiApp, Ticker, Animations, Pooling
│              src/runtime/                       │
├─────────────────────────────────────────────────┤
│              Platform Layer                     │  ← EventBus, Network, Audio, i18n, Logger
│              src/platform/                      │
└─────────────────────────────────────────────────┘
```

**Why this layering?**
- **Testability:** Lower layers have no UI dependencies; they can be unit-tested in isolation.
- **Replaceability:** Swap Pixi.js for another renderer without touching game logic.
- **Reusability:** The same engine/modules can power multiple games with different configs.

---

## 5. Bootstrap & Application Shell

**Path:** `src/bootstrap/`

| File | Purpose |
|------|---------|
| `main.tsx` | Vite entry point — mounts React app to DOM |
| `App.tsx` | Root component — wraps everything in Providers |
| `Providers.tsx` | Sets up React Query, theme, i18n, and other context providers |
| `Router.tsx` | Defines routes: `/` (Lobby), `/game/:gameId` (Game), `/debug` (Debug tools) |
| `ErrorBoundary.tsx` | Catches React errors and shows fallback UI |

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

**Why?** This enables players to refresh the page or open games in new tabs without losing their session state.

---

## 6. Platform Layer — Infrastructure Services

**Path:** `src/platform/`

This layer provides foundational services used by every other layer. Components here have **zero game logic** — they are generic infrastructure.

### 6.1 EventBus (`src/platform/events/`)

The **nervous system** of the entire framework. All inter-component communication flows through here.

| File | Purpose |
|------|---------|
| `EventBus.ts` | Singleton pub/sub with priority-based dispatch, queueing, and history |
| `EventMap.ts` | **800+ lines** of TypeScript interfaces defining every event payload |
| `EventEnvelope.ts` | Wraps each event with metadata: timestamp, source, stop propagation |
| `EventHistory.ts` | Circular buffer recording recent events for debugging/replay |
| `EventScheduler.ts` | Delayed/periodic event scheduling |
| `EventTimeline.ts` | Time-ordered event sequences for animations |
| `EventTracker.ts` | Development tool — tracks event frequency and listeners |

**Key Design Points:**
- **Type-safe:** Every event has a typed payload via `EventMap`. Publishing `game:spin:start` requires a `SpinStartPayload`.
- **Priority dispatch:** Handlers are sorted by priority (higher first). Ties broken by insertion order (configurable).
- **Propagation control:** Handlers can call `envelope.stopPropagation()` to prevent lower-priority handlers from running.
- **Event queueing:** Events emitted *during* event processing are queued and processed after the current batch.
- **Isolated instances:** `EventBus.createIsolated()` creates a separate instance for replay/testing without polluting the singleton.

### 6.2 Networking (`src/platform/networking/`)

Adapter-pattern network layer supporting multiple transport protocols.

| File | Purpose |
|------|---------|
| `NetworkManager.ts` | Unified API — delegates to the active adapter |
| `INetworkAdapter.ts` | Interface all adapters implement |
| `RestAdapter.ts` | HTTP/REST implementation |
| `StompAdapter.ts` | WebSocket/STOMP for real-time server push |
| `MockAdapter.ts` | In-memory mock for development/testing |
| `MockGameServer.ts` | Simulates server-side game logic (RNG, paytable evaluation) |
| `SessionTokenManager.ts` | JWT-like token management with localStorage persistence |
| `APIProtocol.ts` | Request/response type definitions for all API endpoints |
| `PayloadMapper.ts` | Maps raw server responses to internal domain types |
| `PayloadValidator.ts` | Validates server payloads against expected schemas |
| `RetryPolicy.ts` | Configurable retry with exponential backoff |

**Adapter Selection Priority:**
1. Runtime override (`config.networkMode`)
2. Per-game config (`public/game-configs/games/<gameId>/network.json`)
3. Environment config (`src/config/env.config.ts`)

**Why the Adapter Pattern?**
- **Development:** Use `MockAdapter` — no server needed, instant feedback.
- **Integration testing:** Use `RestAdapter` against a staging server.
- **Production:** Use `StompAdapter` for real-time, persistent connections.
- **Runtime switching:** Call `networkManager.setAdapter('rest')` to change adapters without restarting.

### 6.3 Audio (`src/platform/audio/`)

| File | Purpose |
|------|---------|
| `AudioBus.ts` | Event-driven audio routing |
| `AudioRegistry.ts` | Sound asset registry and lookup |
| `SoundManager.ts` | Low-level Howler.js wrapper |

### 6.4 Localization (`src/platform/localization/`)

| File | Purpose |
|------|---------|
| `LocaleManager.ts` | Language switching and string lookup |
| `LocaleResolver.ts` | Resolves locale from browser/config |
| `LanguagePack.ts` | Language pack loader |
| `strings.*.json` | Translation files (en, de, es, ar, hi, ru, zh, zh-TW) |

### 6.5 Logger (`src/platform/logger/`)

| File | Purpose |
|------|---------|
| `Logger.ts` | Named logger instances (`Logger.create('GameController')`) |
| `LogLevel.ts` | DEBUG, INFO, WARN, ERROR levels |
| `LogFormatter.ts` | Structured log formatting |
| `LoggerController.ts` | Global log level control |
| `LoggerFactory.ts` | Logger instance creation |
| `transports/` | Console, remote, buffer transports |

---

## 7. Engine Layer — The Brain

**Path:** `src/engine/`

The engine orchestrates the entire game lifecycle — from initialization through running to destruction.

### 7.1 Core (`src/engine/core/`)

| File | Purpose |
|------|---------|
| `EngineKernel.ts` | **The orchestrator.** Initializes all subsystems in order, manages lifecycle. |
| `EngineStateMachine.ts` | Finite state machine with guarded transitions |
| `EngineLifecycle.ts` | Lifecycle hooks (init, start, pause, resume, destroy) |
| `EngineMode.ts` | Game mode definitions (base, freeSpins, bonus) |
| `EngineGuards.ts` | Transition guard conditions |
| `GameLoader.ts` | 6-phase loading sequence (session → launch → config → assets → stage → ready) |
| `SlotEngine.ts` | Legacy engine wrapper |

#### EngineKernel — Initialization Sequence

```
EngineKernel.initialize(config)
│
├── 1. Initialize NetworkManager (per-game config)
├── 2. GameLoader.loadGame() — 6 phases:
│   ├── Phase 1: Check for existing session (SessionTokenManager)
│   ├── Phase 2: Game launch via NetworkManager (server validation)
│   ├── Phase 3: Load game config (JSON files)
│   ├── Phase 4: Preload assets (textures, spine, audio)
│   ├── Phase 5: Create stage (placeholder)
│   └── Phase 6: Ready
├── 3. Initialize Pixi (WebGL canvas)
├── 4. Initialize StageManager (layer tree)
├── 5. Create PixiTicker (60fps game loop)
├── 6. Initialize ConfigurableSymbolPool
├── 7. Compose visual layers (Background → Title → Screen → Transition → Toast → Overlay → Debug)
├── 8. Initialize ScreenManager
├── 9. Initialize TickManager
├── 10. Initialize GameController (from session data)
├── 11. Initialize AudioManager + AudioController
├── 12. Apply initial spin strategy from config
├── 13. Initialize PresentationOrchestrator
├── 14. Switch to BaseScreen
├── 15. Emit 'engine:ready'
└── Done — engine is running
```

#### EngineStateMachine — Valid State Transitions

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

**Why a State Machine?**
- Prevents invalid operations (e.g., spinning while already spinning).
- Makes debugging deterministic — you can see the full state history.
- Guards allow conditional transitions (e.g., "only allow spin if balance >= bet").

### 7.2 Flow System (`src/engine/flow/`)

| File | Purpose |
|------|---------|
| `FlowSystem.ts` | Executes sequential flow types (SPIN, FREE_SPINS, BONUS, WIN_PRESENTATION) |
| `FlowTypes.ts` | Flow type and step enums |
| `FlowEvents.ts` | Flow-related event definitions |

The `FlowSystem` manages the high-level sequence of a game round:

```
SPIN Flow:
  SPIN_START → REELS_SPINNING → REELS_STOPPING → WIN_EVALUATION → SPIN_COMPLETE

FREE_SPINS Flow:
  FEATURE_TRIGGER → FEATURE_INTRO → FEATURE_PLAY

WIN_PRESENTATION Flow:
  WIN_EVALUATION → WIN_PRESENTATION
```

**Why a Flow System?**
- Ensures steps execute in the correct order.
- Supports flow queuing — if a bonus triggers during a spin, it queues after completion.
- Each flow type can be customized per game via config.

### 7.3 Plugin System (`src/engine/plugin/`)

| File | Purpose |
|------|---------|
| `SlotPlugin.ts` | Abstract base class for all plugins |
| `PluginRegistry.ts` | Central registry — manages load order by priority + dependencies |
| `PluginDependencyGraph.ts` | Topological sort for dependency resolution |
| `PluginResolver.ts` | Resolves plugin instances by ID |

See [Section 17: Plugin System](#17-plugin-system) for details.

### 7.4 Audio Engine (`src/engine/audio/`)

| File | Purpose |
|------|---------|
| `AudioManager.ts` | High-level audio control (channels, global mute, focus handling) |
| `AudioController.ts` | Wires EventBus events to audio actions per game |
| `AudioChannel.ts` | Named audio channels with independent volume |
| `AudioConfigResolver.ts` | Resolves audio config from game JSON |
| `AudioEventBus.ts` | Audio-specific event routing |
| `AudioSpriteLoader.ts` | Loads audio sprite sheets |

### 7.5 Data (`src/engine/data/`)

| File | Purpose |
|------|---------|
| `DataStore.ts` | Generic key-value store for game data |
| `DataHydrator.ts` | Reconstructs state from serialized data |
| `DataSerializer.ts` | Serializes state for persistence/replay |
| `DataSnapshot.ts` | Point-in-time state captures |

---

## 8. Module System — Pluggable Game Mechanics

**Path:** `src/modules/`

Modules are the **game-specific logic** that gets mixed and matched per game. Each module is a `SlotPlugin` registered at startup.

### 8.1 Registry (`src/modules/registry/`)

| File | Purpose |
|------|---------|
| `ModuleRegistry.ts` | Registers all available modules at startup |
| `SpinStrategyRegistry.ts` | Registry specifically for spin strategies |

`ModuleRegistry.initialize()` registers:
- All spin strategies (cascade, cluster, megaways, infinity, dualboard)
- All features (freespins, stickywild, expandingwild, multiplier, bonus)
- All win systems (paylines, ways, cluster, megaways)
- All spin mechanisms (holdRespin, lockSequence, etc.)

### 8.2 Mechanics — Spin Strategies (`src/modules/mechanics/`)

Each mechanic defines how reels behave during a spin.

| Mechanic | Directory | Description |
|----------|-----------|-------------|
| **Standard** | `standard/` | Classic top-to-bottom reel spin |
| **Cascade** | `cascade/` | Winning symbols disappear, new ones fall in (Tumble) |
| **Cluster** | `cluster/` | Wins by clusters of adjacent symbols (no paylines) |
| **Megaways** | `megaways/` | Variable reel heights per spin (up to 117,649 ways) |
| **Infinity** | `infinity/` | Endless expanding grid |
| **Dual Board** | `dualboard/` | Two grids side by side |

**Why separate mechanics?** Each game may use a completely different spin behavior. The `SpinStrategyRegistry` lets the `GameController` switch strategies by string ID from config:

```json
// In game manifest
{ "baseGame": { "spinStrategy": "cascade" } }
```

### 8.3 Features (`src/modules/features/`)

Features add special game mechanics on top of the base spin.

| Feature | Directory | Description |
|---------|-----------|-------------|
| **Free Spins** | `freespins/` | Awarded spins at no cost, often with multipliers |
| **Sticky Wilds** | `wilds/StickyWildFeature.ts` | Wild symbols that persist across spins |
| **Expanding Wilds** | `wilds/ExpandingWildFeature.ts` | Wilds that expand to fill an entire reel |
| **Multipliers** | `multipliers/` | Win multiplier progression |
| **Bonus** | `bonus/` | Pick-and-reveal bonus rounds |
| **Spin Mechanisms** | `spinmechanisms/` | Hold & Respin, Lock Sequence, Multi-Spin, Collection, etc. |

Each feature extends `SlotPlugin` and is enabled/disabled per game via the manifest.

### 8.4 Win Systems (`src/modules/winsystems/`)

Win systems define *how* wins are evaluated.

| System | Directory | Description |
|--------|-----------|-------------|
| **Paylines** | `paylines/LineEvaluator.ts` | Fixed lines (e.g., 20 lines) |
| **Ways** | `ways/WaysEvaluator.ts` | All-ways (e.g., 243 or 1024 ways) |
| **Cluster** | `cluster/ClusterEvaluator.ts` | Adjacent symbol clusters |
| **Megaways** | `megaways/MegawaysEvaluator.ts` | Variable ways with dynamic reel heights |

> **Important:** In production, the server evaluates wins. These client-side evaluators are used for the mock adapter and visual presentation logic.

---

## 9. Gameplay Layer — Game Logic & Orchestration

**Path:** `src/gameplay/`

### 9.1 Engine (`src/gameplay/engine/`)

| File | Purpose |
|------|---------|
| `GameController.ts` | **Main game loop.** Handles spin requests, server communication, result presentation. |
| `SpinLoop.ts` | Controls reel spin start/stop timing |
| `PresentationOrchestrator.ts` | Orchestrates visual win presentations |
| `ResultPresentationController.ts` | Step-by-step result presentation (RESULT → CASCADE → WIN) |
| `StepSequencePresenter.ts` | Presents individual spin result steps |
| `FlowOrchestrator.ts` | Higher-level flow coordination |
| `GameClock.ts` | Game-relative time tracking |
| `TickManager.ts` | Frame tick distribution to registered listeners |
| `PauseManager.ts` | Pause/resume logic |
| `VisibilityManager.ts` | Browser tab visibility handling |
| `Scheduler.ts` | Delayed action scheduling |

#### GameController — Spin Flow

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
   b. Update balance from server (authoritative)
   c. Emit 'game:spin:result' with initial matrix
   d. Stop SpinLoop with symbols (reels stop)
   e. Wait for 'game:reels:stopped'
6. On reels stopped:
   a. Run step-by-step presentation (ResultPresentationController)
   b. For each step: show wins, cascade, multipliers
   c. Apply final grid state
   d. Emit 'game:spin:complete'
7. State → IDLE (ready for next spin)
```

**Why server-authoritative?**
- Prevents client-side cheating.
- Ensures regulatory compliance (certified RNG on server).
- Client is purely a presentation layer.

### 9.2 State (`src/gameplay/state/`)

| File | Purpose |
|------|---------|
| `GameSession.ts` | Master session state — aggregates all sub-states |
| `RoundState.ts` | Current round data (matrix, wins, steps) |
| `WalletState.ts` | Balance, bet, currency |
| `FeatureState.ts` | Active feature tracking (free spins remaining, etc.) |
| `StateSerializer.ts` | Serialize/deserialize for persistence |

### 9.3 Models (`src/gameplay/models/`)

| File | Purpose |
|------|---------|
| `GameModel.ts` | Game configuration model (grid size, ways count) |
| `RoundModel.ts` | Round data structures (Position, WinInfo, etc.) |
| `WalletModel.ts` | Wallet domain model |
| `UserModel.ts` | Player profile model |
| `FeatureModel.ts` | Feature state model |

### 9.4 Timeline (`src/gameplay/timeline/`)

A declarative timeline system for sequencing complex animation flows.

| File | Purpose |
|------|---------|
| `TimelineRunner.ts` | Executes timeline action sequences |
| `SequenceBuilder.ts` | Fluent API for building timelines |
| `ParallelAction.ts` | Run multiple actions simultaneously |
| `DelayAction.ts` | Wait for a duration |
| `LoopAction.ts` | Repeat actions |
| `ConditionalAction.ts` | Branch based on conditions |
| `TimelineTypes.ts` | Type definitions |

Example:
```typescript
new SequenceBuilder()
  .add(new DelayAction(500))
  .parallel([
    new FadeInAction(winOverlay),
    new SoundAction('win_fanfare'),
  ])
  .add(new LoopAction(highlightWins, 3))
  .build();
```

### 9.5 Replay (`src/gameplay/replay/`)

| File | Purpose |
|------|---------|
| `ReplayRecorder.ts` | Records all events during a game round |
| `ReplayPlayer.ts` | Replays recorded events on an isolated EventBus |

**Why Replay?**
- QA can reproduce bugs by replaying event sequences.
- Regulatory requirement — some jurisdictions require round replay capability.

### 9.6 Timing (`src/gameplay/timing/`)

| File | Purpose |
|------|---------|
| `TimingProvider.ts` | Reads timing values from config (`public/game-configs/shared/timings.json`) |
| `TurboState.ts` | Manages turbo mode speed multiplier |

---

## 10. Runtime Layer — Pixi.js Rendering

**Path:** `src/runtime/`

### 10.1 Pixi Core (`src/runtime/pixi/core/`)

| Component | Purpose |
|-----------|---------|
| `PixiApplicationManager` | Creates/manages the Pixi.js Application instance |
| `PixiRuntime` | Singleton access to the running Pixi app, canvas, and renderer |
| `PixiTicker` | Wraps Pixi's ticker for frame-by-frame updates |

### 10.2 Stage (`src/runtime/pixi/stage/`)

| Component | Purpose |
|-----------|---------|
| `StageManager` | Manages the display tree root |
| `StageRoot` | Defines z-ordered layers (Background, Title, Screen, Transition, Toast, Overlay, Debug) |

### 10.3 Other Runtime Subsystems

| Directory | Purpose |
|-----------|---------|
| `animation/` | Tween factories, presets, filter management (GSAP-based) |
| `assets/` | Asset preloader with retry and fallback support |
| `containers/` | Reusable Pixi container wrappers |
| `factory/` | Display object factories |
| `pooling/` | Object pools for performance (reuse sprite instances) |
| `spine/` | Spine animation integration and management |
| `viewport/` | Responsive viewport scaling and breakpoint detection |

**Why Object Pooling?**
- Slot games constantly create/destroy symbols. Allocating new sprites every spin causes GC pressure and frame drops.
- The pool pre-creates sprite instances and recycles them, keeping memory stable at 60fps.

---

## 11. Presentation Layer — Visual Components

**Path:** `src/presentation/`

Built on Pixi.js, this layer contains all visual game components.

| Directory | Purpose |
|-----------|---------|
| `grid/` | Reel grid rendering, symbol sprites, reel containers, spin animations |
| `win/` | Win celebration animations, particle effects, win counters |
| `cascade/` | Cascade/tumble visual effects (symbol removal, collapse, refill) |
| `screens/` | Screen management (BaseScreen, LoadingScreen, etc.) |
| `layers/` | Z-ordered visual layers (BackgroundLayer, ScreenLayer, OverlayLayer, etc.) |
| `hud/` | In-canvas HUD elements (bet display, balance, win counter) |
| `transitions/` | Screen transition effects |

### Layer Composition (Z-order, bottom to top)

```
1. BackgroundLayer    — Game background image/animation
2. TitleLayer         — Game title display
3. ScreenLayer        — Main game screen (grid, reels, symbols)
4. TransitionLayer    — Screen transition effects
5. ToastLayer         — Notification toasts
6. OverlayLayer       — Modals, popups, win celebrations
7. DebugLayer         — FPS counter, state inspector (dev only)
```

---

## 12. UI Layer — React Overlay

**Path:** `src/ui/`

React components rendered as an HTML/CSS overlay on top of the Pixi canvas.

| Directory | Purpose |
|-----------|---------|
| `controls/` | Spin button, autoplay controls, turbo toggle |
| `hud/` | Balance display, bet selector, win amount |
| `lobby/` | Game selection grid, game cards |
| `modals/` | Paytable, settings, rules, history |
| `overlays/` | Full-screen overlays (loading, disconnected) |
| `settings/` | Audio, quality, language settings |
| `shell/` | App chrome, navigation, toolbar |
| `pages/` | Top-level pages (LobbyPage, GamePage, DebugPage) |
| `hooks/` | Custom React hooks (`useEngine`, `useGameState`, etc.) |
| `providers/` | React context providers (EngineProvider, ThemeProvider) |

### React ↔ Engine Bridge

React components communicate with the engine exclusively through:

1. **`useEngine()` hook** — Provides access to `EngineKernel` methods.
2. **EventBus subscriptions** — React hooks subscribe to events for reactive updates:
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
- Accessibility (ARIA, keyboard navigation) comes free with Radix primitives.
- Responsive layouts are trivial with Tailwind.
- Hot module reloading for rapid UI iteration.
- Canvas-rendered UIs are harder to make accessible and responsive.

---

## 13. Configuration System

### 13.1 Structure

```
public/game-configs/
├── shared/                          # Shared defaults
│   ├── config.global.json           # Global settings
│   ├── defaults.json                # Default game values
│   ├── timings.json                 # Animation timings
│   ├── symbol-rendering.defaults.json
│   ├── features/                    # Shared feature configs
│   ├── hud/                         # HUD layout config
│   └── layers/                      # Layer config
└── games/
    ├── dragon-fortune/
    │   ├── manifest.json            # Game-specific config
    │   └── network.json             # Network adapter config
    ├── neon-nights/
    │   ├── manifest.json
    │   └── network.json
    └── egyptian-adventure/
        ├── manifest.json
        └── network.json
```

### 13.2 Config Merging

The `GameConfigLoader` merges configs with this priority:

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
- **Assets:** Textures, spine animations, audio files
- **Responsive layouts:** Per-breakpoint positioning

### 13.4 Network Config

Per-game `network.json` specifies:
```json
{
  "adapterType": "mock",              // "rest" | "stomp" | "mock"
  "rest": { "baseUrl": "/api", "timeout": 30000 },
  "stomp": { "url": "/ws", "reconnectDelay": 5000 }
}
```

**Why config-driven?**
- Add a new game by adding JSON files — zero code changes.
- QA can test different configurations without rebuilding.
- Operators can customize games (bet limits, features) per jurisdiction.

---

## 14. EventBus — Communication Backbone

### 14.1 How It Works

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

### 14.2 Event Categories

| Category | Prefix | Examples |
|----------|--------|---------|
| Engine lifecycle | `engine:` | `engine:ready`, `engine:pause`, `engine:error` |
| Game actions | `game:` | `game:spin:start`, `game:spin:result`, `game:spin:complete` |
| Feature lifecycle | `feature:` | `feature:triggered`, `feature:start`, `feature:end` |
| UI interactions | `ui:` | `ui:bet:change`, `ui:button:press`, `ui:modal:open` |
| Network | `network:` | `network:request`, `network:response`, `network:error` |
| Wallet | `wallet:` | `wallet:balance:update` |
| Audio | `sound:` / `music:` | `sound:play`, `music:change` |
| Assets | `assets:` | `assets:load:start`, `assets:load:progress`, `assets:load:complete` |
| Viewport | `viewport:` | `viewport:resize`, `viewport:breakpoint:changed` |
| Session | `session:` | `session:initialized`, `session:ready` |
| Round | `round:` | `round:started`, `round:result`, `round:complete` |
| Cascade | `cascade:` | `cascade:start`, `cascade:step:start`, `cascade:complete` |
| Free Spins | `freespins:` | `freespins:trigger`, `freespins:spin:start` |

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
    ├──→ Win highlights shown
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
// Critical handler — runs first (priority 100)
eventBus.on('game:spin:start', validateBalance, 100);

// Normal handler — runs after (priority 0, default)
eventBus.on('game:spin:start', playSpinSound);

// Low priority — runs last
eventBus.on('game:spin:start', logAnalytics, -10);
```

**Why Priority?**
- Validation must run before side effects (audio, animations).
- A validation handler can call `envelope.stopPropagation()` to cancel the spin.

---

## 15. Full Lifecycle Flow: Lobby → Game Launch → Spin → Win

### Phase 1: Application Boot

```
1. Vite loads main.tsx
2. React renders App.tsx → Providers.tsx → Router.tsx
3. Router renders LobbyPage at "/"
4. LobbyPage displays available game cards
```

### Phase 2: Game Selection

```
1. User clicks a game card (e.g., "Neon Nights")
2. React Router navigates to /game/neon-nights
3. GamePageWithSession validates session via SessionTokenManager
4. GamePage mounts EngineProvider
```

### Phase 3: Engine Initialization

```
1. EngineProvider creates EngineKernel singleton
2. EngineKernel.initialize({ containerId, gameId: 'neon-nights' })
3. NetworkManager initializes with per-game config (mock adapter)
4. GameLoader runs 6-phase sequence:
   a. Check session → create new
   b. Game launch → MockAdapter returns game config
   c. Load JSON configs → merge shared + game-specific
   d. Preload assets → textures, spine, audio (with fallback)
   e. Create stage → (deferred to kernel)
   f. Ready
5. Pixi canvas created and inserted into DOM
6. Stage layers composed (Background → ... → Debug)
7. ScreenManager switches to BaseScreen (grid + reels)
8. GameController initialized from session data
9. AudioController mounted for this game
10. EventBus emits 'engine:ready'
```

### Phase 4: Gameplay (Spin Cycle)

```
1. User adjusts bet via UI → emits 'ui:bet:change'
2. User clicks SPIN → emits 'game:spin:request'
3. GameController validates, deducts bet, emits 'game:spin:start'
4. Reels start spinning (visual animation)
5. NetworkManager sends spin request to server/mock
6. Server responds with result (matrix, wins, steps, features)
7. Reels stop with server-provided symbols
8. Step-by-step presentation plays (wins, cascades, multipliers)
9. Final state applied to grid
10. Round completes → state returns to IDLE
```

### Phase 5: Feature Trigger (e.g., Free Spins)

```
1. Server response includes featuresTriggered: ['freeSpins']
2. GameController emits 'feature:triggered'
3. EngineKernel listens → sets feature spin strategy
4. FreeSpinFeature activates
5. State → FEATURE
6. Free spin rounds play automatically
7. Feature completes → emits 'feature:end'
8. State → IDLE, base game spin strategy restored
```

### Phase 6: Cleanup

```
1. User navigates away (or closes tab)
2. EngineKernel.destroy() called
3. All subsystems destroyed in reverse order:
   AudioController → AudioManager → TickManager → GameController →
   PresentationOrchestrator → SymbolPool → ScreenManager →
   StageManager → PixiManager → ConfigLoader → GameLoader →
   NetworkManager → EventBus
4. All singletons reset to null
```

---

## 16. Network Architecture

### 16.1 Adapter Pattern

```
┌─────────────────┐
│  NetworkManager  │  ← Unified API (gameLaunch, spin, featureAction, buyBonus)
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

### 16.2 API Protocol

All requests follow a standard envelope:

```typescript
interface GameRequest {
  type: 'gameLaunch' | 'spin' | 'featureAction' | 'buyBonus';
  meta: { requestId, timestamp, clientVersion };
  auth: { sessionToken };
  data: { ... };  // type-specific payload
}
```

### 16.3 Mock Server

The `MockGameServer` simulates server-side logic for development:
- Random matrix generation with configurable symbol weights
- Paytable-based win evaluation
- Feature trigger logic (scatter count triggers free spins)
- Balance management
- Cascade step generation

---

## 17. Plugin System

### 17.1 SlotPlugin Base Class

Every module (feature, win system, mechanic) extends `SlotPlugin`:

```typescript
abstract class SlotPlugin {
  id: string;              // Unique identifier
  version: string;         // Semantic version
  priority: PluginPriority; // Load order priority
  dependencies: string[];   // Required plugins
  enabled: boolean;         // Active state

  abstract onLoad(): Promise<void>;    // Async initialization
  abstract onUnload(): Promise<void>;  // Cleanup
  abstract onEnable(): void;           // Activate
  abstract onDisable(): void;          // Deactivate
}
```

### 17.2 Load Order

The `PluginRegistry` resolves load order by:
1. **Priority:** CRITICAL (0) → HIGH (25) → NORMAL (50) → LOW (75) → OPTIONAL (100)
2. **Dependencies:** If plugin A depends on B, B loads first (topological sort)

### 17.3 Registration Flow

```
ModuleRegistry.initialize()
  │
  ├── registerSpinStrategies() → SpinStrategyRegistry
  │   └── cascade, cluster, megaways, infinity, dualboard
  │
  ├── registerFeatures() → PluginRegistry
  │   └── freespins, stickywild, expandingwild, multiplier, bonus
  │
  ├── registerWinSystems() → PluginRegistry
  │   └── paylines, ways, cluster, megaways
  │
  └── registerSpinMechanisms() → SpinMechanismRegistry
      └── holdRespin, lockSequence, multiSpin, collection, etc.
```

---

## 18. State Management

### 18.1 Architecture

State is managed through **singleton service classes** rather than a centralized store (like Redux):

```
GameSession (master)
├── GameModel       — Grid dimensions, ways count, game ID
├── RoundState      — Current round: matrix, wins, steps
├── WalletState     — Balance, bet, currency
├── FeatureState    — Active feature, remaining spins, multiplier
└── UserModel       — Player ID, preferences
```

**Why not Redux/Zustand?**
- The engine runs outside React — it needs state accessible from non-React code (Pixi containers, audio controllers).
- Singleton services with EventBus notifications provide the same reactivity pattern with less boilerplate.
- State changes are emitted as events — any subscriber (React hook, Pixi container, logger) can react.

### 18.2 State Flow

```
Server Response → PayloadMapper → GameSession.update() → EventBus.emit() → UI/Pixi react
```

---

## 19. Audio System

### 19.1 Architecture

```
┌─────────────────┐     events      ┌──────────────────┐
│  AudioController │ ←────────────── │     EventBus     │
│  (game-specific) │                 └──────────────────┘
└────────┬────────┘
         │ commands
         ▼
┌─────────────────┐
│  AudioManager    │  ← channels, volume, focus handling
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SoundManager    │  ← Howler.js wrapper
└─────────────────┘
```

### 19.2 Event-Driven Audio

The `AudioController` maps game events to sounds:
- `game:spin:start` → play "reel_spin" loop
- `reel:spin:stop` → play "reel_stop" one-shot
- `game:win:detected` → play "win_small" / "win_big" based on amount
- `feature:triggered` → play "feature_fanfare"

**Why event-driven?**
- Audio is completely decoupled from game logic.
- Replacing sound assets requires zero code changes.
- Audio can be disabled/mocked for testing.

---

## 20. Extending the Framework

### 20.1 Adding a New Game

1. Create `public/game-configs/games/<game-id>/manifest.json`
2. Create `public/game-configs/games/<game-id>/network.json`
3. Add game assets to `public/assets/games/<game-id>/`
4. Add a game card in `LobbyPage`
5. **Zero code changes** to engine, modules, or gameplay layers.

### 20.2 Adding a New Spin Strategy

1. Create `src/modules/mechanics/<name>/<Name>SpinStrategy.ts`
2. Extend `SlotPlugin` or implement `ISpinStrategy`
3. Register in `ModuleRegistry.registerSpinStrategies()`:
   ```typescript
   registry.register('myStrategy', (config) => new MySpinStrategy(config));
   ```
4. Reference in game manifest: `{ "spinStrategy": "myStrategy" }`

### 20.3 Adding a New Feature

1. Create `src/modules/features/<name>/<Name>Feature.ts`
2. Extend `SlotPlugin`
3. Subscribe to relevant events in `onEnable()`
4. Register in `ModuleRegistry.registerFeatures()`:
   ```typescript
   this.featureInstances.set('myFeature', new MyFeature());
   ```
5. Enable in game manifest: `{ "features": ["myFeature"] }`

### 20.4 Adding a New Win System

1. Create `src/modules/winsystems/<name>/<Name>Evaluator.ts`
2. Implement `IWinEvaluator` interface
3. Register in `ModuleRegistry.registerWinSystems()`

### 20.5 Adding New Events

1. Add payload interface to `src/platform/events/EventMap.ts`
2. Add event type to the `EventMap` interface mapping
3. All existing `EventBus` type checking will automatically enforce the new payload

---

## 21. Design Decisions & Rationale

### Why Singleton Pattern?

Most engine services (EventBus, EngineKernel, NetworkManager, GameSession) use the singleton pattern because:
- There is exactly one game engine instance per browser tab.
- Services need to be accessible from both React components and non-React code (Pixi, audio).
- The alternative (dependency injection container) adds complexity without benefit for a single-game-per-tab architecture.
- Singletons are reset on destroy — no stale state between game sessions.

### Why EventBus over Direct Calls?

- **Decoupling:** The AudioController doesn't need to know about the GameController.
- **Extensibility:** Adding a new listener doesn't modify existing code.
- **Debugging:** Event history provides a complete audit trail.
- **Testing:** Events can be intercepted, recorded, and replayed.

### Why Pixi.js + React (Dual Rendering)?

- **Pixi.js** excels at GPU-accelerated 2D rendering (symbols, animations, particles) at 60fps.
- **React** excels at UI (forms, modals, tooltips, accessibility, responsive layout).
- Combining both gives the best of both worlds. The alternative — rendering everything in canvas — sacrifices accessibility and makes responsive UI extremely hard.

### Why Config-Driven?

- **Operator customization:** Different casinos can configure bet limits, feature availability, and payouts.
- **A/B testing:** Test different configurations without code deploys.
- **Rapid iteration:** Designers can tweak timings, sizes, and animations via JSON.
- **Multi-game support:** One codebase powers multiple games with different configs.

### Why Server-Authoritative?

- **Regulatory compliance:** Gambling regulators require certified server-side RNG.
- **Cheat prevention:** Client never calculates wins; it only presents them.
- **Consistency:** All players experience the same mathematical model regardless of client version.

### Why the Adapter Pattern for Networking?

- **Development speed:** MockAdapter enables offline development with zero server dependency.
- **Testing flexibility:** Switch to REST adapter for integration tests.
- **Production readiness:** STOMP adapter provides real-time push for production.
- **Runtime switching:** Useful for failover (STOMP → REST on WebSocket failure).

---

## 22. Glossary

| Term | Definition |
|------|-----------|
| **BaseGame** | The primary game mode where normal spins occur |
| **Cascade/Tumble** | Winning symbols are removed and new ones fall in, allowing chain wins |
| **EventBus** | Central pub/sub system for inter-component communication |
| **Feature** | A special game mode triggered during play (Free Spins, Bonus, Hold & Respin) |
| **FlowSystem** | Manages the sequence of steps within a game round |
| **GameController** | Main game loop — handles spin requests and result presentation |
| **Grid/Matrix** | The 2D array of symbols displayed on the reels |
| **HUD** | Heads-Up Display — balance, bet, win counters |
| **Kernel** | The central engine orchestrator that initializes and manages all subsystems |
| **Manifest** | Per-game JSON configuration defining all game parameters |
| **MatrixString** | Compact string representation of the grid (e.g., "AABCD;BCAAD;DDBCA") |
| **Mechanism** | A pluggable spin-flow behavior (Hold & Respin, Lock Sequence, etc.) |
| **MockAdapter** | In-memory network adapter that simulates server responses |
| **Payline** | A predefined line across the grid where matching symbols create a win |
| **Paytable** | Lookup table defining symbol combination values |
| **Plugin** | A modular game component (feature, win system, mechanic) |
| **Reel** | A vertical column of symbols that spins |
| **RNG** | Random Number Generator — determines spin outcomes (server-side) |
| **Round** | One complete spin cycle: request → result → presentation → complete |
| **Session** | A player's active connection to a game, persisted across page refreshes |
| **Spin Strategy** | Defines how reels animate (top-to-bottom, cascade, megaways, etc.) |
| **Stage** | The Pixi.js display tree containing all visual layers |
| **Step** | One sub-result within a round (e.g., initial RESULT, CASCADE step 1, CASCADE step 2) |
| **Ways** | A win system where matching symbols on adjacent reels create wins (no fixed lines) |
| **Wild** | A symbol that substitutes for other symbols to form wins |

---

## Appendix A: File Index

### Platform (`src/platform/`)
```
events/EventBus.ts              — Pub/sub backbone
events/EventMap.ts              — 800+ lines of typed event contracts
events/EventEnvelope.ts         — Event metadata wrapper
events/EventHistory.ts          — Event recording
events/EventScheduler.ts        — Delayed event dispatch
events/EventTimeline.ts         — Time-ordered sequences
events/EventTracker.ts          — Debug event monitoring
networking/NetworkManager.ts    — Adapter-based network layer
networking/INetworkAdapter.ts   — Adapter interface
networking/RestAdapter.ts       — HTTP adapter
networking/StompAdapter.ts      — WebSocket adapter
networking/MockAdapter.ts       — Development mock
networking/MockGameServer.ts    — Simulated game server
networking/SessionTokenManager.ts — Session persistence
networking/APIProtocol.ts       — Request/response types
networking/PayloadMapper.ts     — Server → client mapping
networking/PayloadValidator.ts  — Response validation
networking/RetryPolicy.ts       — Retry logic
audio/AudioBus.ts               — Audio event routing
audio/AudioRegistry.ts          — Sound registry
audio/SoundManager.ts           — Howler.js wrapper
localization/LocaleManager.ts   — i18n management
logger/Logger.ts                — Named logger
```

### Engine (`src/engine/`)
```
core/EngineKernel.ts            — Central orchestrator
core/EngineStateMachine.ts      — FSM with guarded transitions
core/GameLoader.ts              — 6-phase loading sequence
core/EngineLifecycle.ts         — Lifecycle hooks
core/EngineMode.ts              — Game modes
core/EngineGuards.ts            — Transition guards
flow/FlowSystem.ts              — Game flow sequencing
flow/FlowTypes.ts               — Flow enums
plugin/SlotPlugin.ts            — Plugin base class
plugin/PluginRegistry.ts        — Plugin management
plugin/PluginDependencyGraph.ts — Dependency resolution
audio/AudioManager.ts           — Audio subsystem
audio/AudioController.ts        — Event → audio mapping
data/DataStore.ts               — Key-value store
data/DataSerializer.ts          — State serialization
```

### Gameplay (`src/gameplay/`)
```
engine/GameController.ts              — Main game loop
engine/SpinLoop.ts                    — Reel animation control
engine/PresentationOrchestrator.ts    — Win presentation
engine/ResultPresentationController.ts — Step-by-step results
engine/StepSequencePresenter.ts       — Individual step presentation
engine/TickManager.ts                 — Frame update distribution
state/GameSession.ts                  — Master state
state/RoundState.ts                   — Round data
state/WalletState.ts                  — Balance tracking
models/RoundModel.ts                  — Data structures
timeline/TimelineRunner.ts            — Animation sequencing
replay/ReplayRecorder.ts              — Event recording
replay/ReplayPlayer.ts                — Event playback
```

---

*This document should be kept up-to-date as the framework evolves. When adding new modules, features, or architectural changes, update the relevant sections above.*

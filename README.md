# 🏋️ Null Gym · v2.0 Final Release

<div align="center">

[![Version](https://img.shields.io/badge/version-2.0.0--final-EF4444?style=for-the-badge&logo=rocket&logoColor=white)](https://github.com/Null72X/Null-Gym)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Catalog](https://img.shields.io/badge/Catalog-1%2C323_Exercises-10B981?style=for-the-badge&logo=ghost)](https://github.com/Null72X/Null-Gym)
[![PWA Ready](https://img.shields.io/badge/PWA-100%25_Offline-F59E0B?style=for-the-badge&logo=pwa)](https://github.com/Null72X/Null-Gym)

**The Offline-First, High-Performance Progressive Overload & Workout Architecture.**  
*Zero fluff. Zero paywalls. Zero subscriptions. Sub-millisecond execution in gym basements.*

[Live Demo](https://null-gym.vercel.app) · [Report Bug](https://github.com/Null72X/Null-Gym/issues) · [Request Feature](https://github.com/Null72X/Null-Gym/issues)

</div>

---

## 📖 Table of Contents

- [The Philosophy](#-the-philosophy)
- [Key Features at a Glance](#-key-features-at-a-glance)
- [1,323 ExerciseDB Catalog & Visual Form Guides](#-1323-exercisedb-catalog--visual-form-guides)
- [Bi-Weekly Progressive Overload Engine](#-bi-weekly-progressive-overload-engine)
- [1-Click "Start Next 6-Week Cycle 🚀"](#-1-click-start-next-6-week-cycle-)
- [Offline-First PWA Architecture](#-offline-first-pwa-architecture)
- [Set HUD, Rest Timer & Tracking System](#-set-hud-rest-timer--tracking-system)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started](#-getting-started)
- [Mobile Installation (PWA)](#-mobile-installation-pwa)
- [Credits & Acknowledgments](#-credits--acknowledgments)
- [License](#-license)

---

## 💡 The Philosophy

Modern fitness apps have become bloated subscription-traps burdened with heavy analytics trackers, mandatory logins, unskippable paywalls, and slow network spinners. When you are lifting in an underground gym basement or airplane hangar without a cell signal, standard workout apps break down.

**Null Gym** was engineered around four uncompromising pillars:
1. **Sub-Millisecond Speed**: Everything operates instantaneously with zero layout shift and pre-indexed memory caches.
2. **100% Offline Capability**: Complete functionality, including 1,323 exercises and animated form guides, runs entirely client-side without internet connectivity.
3. **Evidence-Based Periodization**: Built-in bi-weekly overload progression and seamless cycle rollover eliminate guesswork from load increases.
4. **Total Privacy & Data Ownership**: Your workout data stays on your device. Single-click JSON backup and restore with optional end-to-end encrypted Supabase cloud sync.

---

## ✨ Key Features at a Glance

| Feature | Description |
| :--- | :--- |
| 📚 **1,323 Exercise Database** | Integrated ExerciseDB catalog featuring 10 muscle groups, equipment filtering, instructions, and animated GIFs. |
| ⚡ **Sub-Millisecond Search** | Token-pre-indexed in-memory search delivering instant results across all 1,323 movements in <1ms. |
| 📈 **Bi-Weekly Progressive Overload** | Periodized overload engine automatically calculating load bumps every 2 weeks ($W1/2 \to W3/4 \to W5/6$). |
| 🚀 **1-Click Cycle 2 Rollover** | Instantly advances to the next 6-week cycle, promoting Week 6 peak loads to new baselines while clearing checkmarks. |
| ⏱️ **Floating Audio Rest Timer** | Persistent countdown timer with $+30\text{s}/-30\text{s}$ controls, Web Audio beep synthesis, and device vibration. |
| 🎯 **Precision Set HUD** | Supports Warmup (`W`), Straight (`S`), Drop (`D`), and Failure (`F`) sets with weight steppers ($0.5\text{kg}$ micro-plates). |
| 📊 **Historical Ghost Performance** | "LAST TIME" card shows previous loads, reps, and RPE for each movement so you know exactly what to beat. |
| 📶 **Offline PWA Engine** | Service Worker with Cache-First storage strategy and installable manifest for iOS, Android, and Desktop. |
| ☁️ **Dual Cloud Sync** | Operates standalone offline via LocalStorage; seamlessly pairs with Supabase when credentials are provided. |

---

## 📚 1,323 ExerciseDB Catalog & Visual Form Guides

Null Gym incorporates the comprehensive **ExerciseDB** dataset containing **1,323 cataloged exercises**:

- **Target Muscle Groups**: Chest, Lats, Upper Back, Quads, Hamstrings, Glutes, Shoulders, Biceps, Triceps, Calves, and Core / Abs.
- **Equipment Categories**: Barbell, Dumbbell, Cable, Machine, Bodyweight, Resistance Band, Kettlebell, Smith Machine, and Leverage.
- **Step-by-Step Form Cues**: Bulleted technical execution guides for proper biomechanics and joint safety.
- **Animated Demonstration GIFs**: High-definition form animations sourced from the ExerciseGymGifsDB repository with graceful local fallback states.
- **Instant Search & Filter**: Sub-millisecond instant search with multi-select target pills and equipment sorting.

---

## 📈 Bi-Weekly Progressive Overload Engine

Rather than dangerously increasing load every single week, Null Gym implements a **Bi-Weekly Progressive Overload Periodization Model**:

$$\text{Load}(\text{Week}) = \text{Base Weight} + \left(\left\lfloor \frac{\text{Week} - 1}{2} \right\rfloor \times \text{Step}\right)$$

### Overload Cadence:
- **Week 1 (Baseline)**: Establish clean movement technique and form adaptation at base weight ($+0\text{kg}$).
- **Week 2 (Consolidation)**: Reinforce neuromuscular pathways and movement efficiency with the same load ($+0\text{kg}$).
- **Week 3 (Step Up)**: Advance the weight by one overload step ($+1\text{x Step}$, e.g. $+2.5\text{kg}$).
- **Week 4 (Consolidation)**: Adapt and stabilize under the increased load ($+1\text{x Step}$).
- **Week 5 (Step Up)**: Advance to the cycle peak weight ($+2\text{x Step}$, e.g. $+5.0\text{kg}$).
- **Week 6 (Peak Performance)**: Execute at full cycle intensity ($+2\text{x Step}$) before transitioning to Cycle 2.

> Compound movements (Squat, Bench, Deadlift, Overhead Press) and isolation accessories can be configured with independent step increments in **Settings**.

---

## 🚀 1-Click "Start Next 6-Week Cycle"

When you finish your 6-week block, Null Gym allows you to roll over into the next cycle in a single tap:

1. **Peak Load Carryover**: Your highest working weights achieved in Week 6 are automatically set as the new **Week 1 baseline** for Cycle 2.
2. **Automated Periodization**: Weeks 2 through 6 are immediately re-calculated with the bi-weekly overload cadence based on your new baseline.
3. **Pristine State**: All set completion checkmarks and progress bars across all 6 weeks are reset to $0\%$.
4. **Permanent PR History**: All historical logs, volume records, and personal bests remain safely archived in your **Progress & PR Analytics** tab.

Available directly on the **Tracker HUD**, **Planner**, and **Settings** pages.

---

## 📶 Offline-First PWA Architecture

Null Gym is built from the ground up to never depend on an active internet connection:

- **Service Worker (`public/sw.js`)**: Intercepts requests with a Cache-First strategy for static assets, scripts, stylesheets, and fonts.
- **Reactive Local Storage (`lib/storage.ts`)**: Custom event bus broadcasts state changes across all tabs and components without race conditions.
- **Airplane / Gym Basement Mode**: A dedicated toggle in Settings enables Forced Offline Mode, eliminating network overhead and maximizing battery life during workouts.
- **Zero Lock-in Data Portability**: Export your entire dataset (weeks, custom exercises, history, settings) to a formatted JSON file or restore from a backup at any time.

---

## ⏱️ Set HUD, Rest Timer & Tracking System

- **Set Categorization**:
  - `W` **Warm-up**: Low intensity, neuromuscular preparation.
  - `S` **Straight / Working Set**: Core progressive overload driver.
  - `D` **Drop Set**: Immediate load reduction to failure.
  - `F` **Failure / AMRAP**: As Many Reps As Possible to maximum mechanical limit.
- **Floating Rest Bar**:
  - Appears automatically upon completing a working set.
  - Adjust on the fly with $+30\text{s}$ or $-30\text{s}$ buttons.
  - Generates crisp 880Hz audio beeps via the Web Audio API and triggers haptic device vibration when rest time expires.
- **Ghost Data ("LAST TIME")**:
  - Displays the exact weight, reps, and RPE logged in your previous session for that specific exercise so you never have to remember your numbers.

---

## 📁 Project Directory Structure

```text
Null-Gym/
├── app/
│   ├── layout.tsx              # App root layout, viewport meta, navbar & footer
│   ├── page.tsx                # Daily Workout Tracker & active session HUD
│   ├── planner/page.tsx        # 6-Week Workout Planner & day configurator
│   ├── library/page.tsx        # 1,323 ExerciseDB master library & filters
│   ├── history/page.tsx        # Workout logs, PR tracker & progression charts
│   └── settings/page.tsx       # Overload config, Cycle 2 rollover, PWA & credits
├── components/
│   ├── ExerciseLibraryModal.tsx# Fast search modal for adding exercises to days
│   ├── FloatingRestBar.tsx     # Persistent countdown rest timer with audio
│   ├── Footer.tsx              # Production footer with version & attribution
│   └── Navbar.tsx              # Responsive top navigation & autosave indicator
├── lib/
│   ├── exerciseCatalog.ts      # 1,323 pre-indexed ExerciseDB items & search trie
│   ├── progressionEngine.ts    # Bi-weekly overload math & Cycle 2 rollover engine
│   ├── storage.ts              # LocalStorage event-driven data layer & export/import
│   ├── offlineManager.ts       # Offline status detection & cache management
│   └── supabaseSync.ts         # Optional Supabase peer synchronization
├── public/
│   ├── data/exercises.json     # Complete raw ExerciseDB catalog dataset
│   ├── sw.js                   # Production service worker for offline caching
│   ├── manifest.json           # PWA web app manifest
│   └── icons/                  # PWA application icons (192px, 512px)
├── styles/
│   ├── theme.css               # Dark gym aesthetic, CSS variables & typography
│   └── globals.css             # Base resets and utility styles
└── types/
    └── workout.ts              # TypeScript schemas for workouts, sets & progression
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) version `18.17.0` or higher (Node 20+ recommended)
- `npm`, `pnpm`, or `yarn`

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Null72X/Null-Gym.git
   cd Null-Gym
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
# Type check and build Next.js optimized bundle
npm run build

# Start production server
npm run start
```

---

## 📱 Mobile Installation (PWA)

Null Gym is optimized as a Progressive Web App (PWA). You can install it directly to your home screen with zero app store downloads:

### iOS (Safari)
1. Open Null Gym in **Safari**.
2. Tap the **Share** button (box with an arrow pointing up).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **"Add"** in the top right corner.

### Android (Chrome)
1. Open Null Gym in **Google Chrome**.
2. Tap the **three-dot menu** in the top right.
3. Select **"Install App"** or **"Add to Home screen"**.
4. Follow the prompt to install.

### Desktop (Chrome / Edge / Brave)
1. Look for the **Install App icon** (monitor with a down arrow) in the browser address bar.
2. Click **"Install"** to run Null Gym as a standalone windowed app.

---

## 🏆 Credits & Acknowledgments

Null Gym is made possible thanks to the dedication of open-source creators and fitness data providers:

| Contributor / Project | Contribution | Link |
| :--- | :--- | :--- |
| **Null72X** | **Lead Developer & Software Architect** — Concept, architecture, progression engine, UI design, and development of Null Gym. | [GitHub Profile](https://github.com/Null72X) · [Null-Gym](https://github.com/Null72X/Null-Gym) |
| **Exercise Catalog** | **Comprehensive Library & Instructions** — Curated dataset of 1,323 exercises, classifications, muscle targets, and technique cues bundled locally. | Built-in Local Dataset |
| **Jahel Cuadrado** | **Form Visuals & Demonstrations** — Curated high-resolution animated GIF demonstrations mapped to exercises via ExerciseGymGifsDB. | [ExerciseGymGifsDB](https://github.com/JahelCuadrado/ExerciseGymGifsDB) |
| **Lucide Icons** | Clean, minimalist iconography throughout the interface. | [Lucide](https://lucide.dev/) |
| **Next.js & Vercel** | React application framework and hosting platform. | [Next.js](https://nextjs.org/) |

---

## 📄 License

This project is open-source software licensed under the [MIT License](LICENSE).

```text
MIT License

Copyright (c) 2026 Null72X

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

<div align="center">
  <sub>Built with relentless dedication to heavy lifting and clean software architecture.</sub><br>
  <sub><b>Null Gym · v2.0 Final Release</b></sub>
</div>

# Null Gym · Personal Workout Management Website

A personal, private, and fully responsive 6-week workout planner and tracking application built with **Next.js**, **React**, **TypeScript**, and the design system from `New folder`.

---

## Features

- **6-Week Workout Planner**:
  - Full manual control over Week 1 through Week 6.
  - Complete Monday–Sunday coverage with dedicated Rest Day toggles.
  - Fully editable workout names (e.g. *Push #1*, *Pull #1*, *Legs Hypertrophy*, *Upper Power*).
  - Target focus / muscle cues for each session.

- **Dynamic Exercise System**:
  - Add, edit, delete, duplicate, and reorder exercises within any workout.
  - YouTube video links with quick one-click app / browser launch.
  - Form cues & execution notes (with red cue indicator).
  - Prominent alternative substitutions with direct video links.
  - Reusable **Exercise Library** with search and muscle group filters.

- **Unlimited Set System**:
  - Unlimited individual sets per exercise.
  - Independent set types: Warm-up (`W`), Working (`S`), Drop Set (`D`), and Failure (`F`).
  - Independent loads with `+` / `-` steppers (supporting 2.5 kg increments and 0.5 kg micro-plates).
  - Unit support: `KG`, `LBS`, `BW` (Bodyweight), `Assisted`, and `Custom`.
  - Independent target reps, RPE (Rate of Perceived Exertion), and rest times.

- **Workout Tracking & History**:
  - Interactive glowing checkmarks for sets, exercises, and entire workouts.
  - Real-time progress stats (`done/total` sets and workout completion percentage).
  - "Finish Workout" action logs sessions with timestamps, exercises, sets, and calculated volume.

- **Previous Performance ("LAST TIME")**:
  - Automatically queries and displays actual saved historical performance for each exercise.
  - Displays previous loads, reps, and RPEs so you know exactly what to beat.

- **Progress & Personal Records**:
  - 6-Week adherence & completion bar chart.
  - Load progression line charts with glowing gradient styling.
  - Automated Personal Record (PR) tracker for all exercises.
  - Expandable workout history log with set breakdowns.

- **Copy / Duplicate Operations**:
  - Duplicate individual exercises with all sets preserved.
  - Copy Day → Another Day (across any week) with overwrite confirmation.
  - Copy Week → Another Week with overwrite confirmation.

- **Autosave & Persistence**:
  - Real-time automatic persistence to local storage.
  - Top bar reactive status badge (`Saving...` -> `Saved ✓`).
  - Full JSON Export and Import capabilities for backups and syncing.

- **Floating Rest Bar**:
  - Floating countdown rest timer matching reference design.
  - Controls for `-30s`, `+30s`, Pause/Play, and Dismiss.
  - Web Audio API synthesized tone and haptic vibration upon timer completion.

- **Mobile First & Responsive**:
  - Designed for mobile touch usability (large touch targets, steppers, compact cards).
  - Responsive across mobile (<490px), tablets, and desktop displays without horizontal overflow.

---

## Tech Stack & Architecture

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Design system extracted from `New folder` (`styles/theme.css` with CSS variables, radial glows, and JetBrains Mono / Plus Jakarta Sans fonts).
- **Icons**: Lucide React
- **Storage**: Persistent reactive browser storage with event bus and JSON export/import.

---

## Getting Started

### Prerequisites

Node.js v18.17+ or v20+

### Installation & Run

1. Navigate to the project directory:
   ```powershell
   cd C:\Users\ASUS\Downloads\Null-Gym
   ```

2. Run the development server:
   ```powershell
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

To create an optimized production build:
```powershell
npm run build
npm run start
```

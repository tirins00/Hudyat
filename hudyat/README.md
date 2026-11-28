# HUDYAT — Campus Emergency Drill & Evacuation Coordination System

**HUDYAT** is a cross-platform web and Android (Capacitor) emergency drill coordination application designed for **Cebu Institute of Technology – University (CIT-University)**. It streamlines campus-wide earthquake drills by coordinating real-time alerts, Drop-Cover-Hold (DCH) guidance, QR-verified evacuation check-ins, live headcount tracking, SOS escalation, and post-drill reporting across four user roles.

---

## Table of Contents

- [Core Features by Role](#core-features-by-role)
- [Safety & Accessibility Invariants](#safety--accessibility-invariants)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Android Build & Background Alert Setup](#android-build--background-alert-setup)
- [Testing & CI/CD](#testing--cicd)
- [Known Limitations](#known-limitations)

---

## Core Features by Role

| Role | Primary Capabilities |
| :--- | :--- |
| **Student** | Real-time drill alerts (`DCH`, `Evacuate`, `All Clear`), synchronized visual/haptic/audio cues, evacuation route guidance, Phase 1 DCH confirmation, Phase 2 assembly QR check-in with manual code fallback (e.g., `ASM-QUAD`), peer check-in, and one-tap SOS reporting. |
| **Teacher** | Expected student attendance list by section/room, live Headcount Board with missing-student monitoring, Teacher-Assisted Check-In & peer check-in verification, and real-time SOS alert acknowledgement/resolution. |
| **Coordinator** | Drill Dashboard to configure and launch drills (customizable DCH duration, blocked nodes/edges), human-in-the-loop phase transitions (`dch` → `evacuate` → `ended`), live response & headcount monitoring, Roster & Schedule CSV import, and Post-Drill Reports. |
| **Admin** | Campus Setup (buildings, floors, map nodes, evacuation edges, graph reachability preview), printable Campus QR Sheets for rooms and assembly areas, Roster/Schedule management, and full drill oversight. |

---

## Safety & Accessibility Invariants

HUDYAT enforces strict safety and usability standards throughout the UI and alert pipeline:

- **3-Click Navigation Rule:** Responsive `AppShell` provides a fixed left desktop sidebar (`lg:` and up) and a safe-area-aware mobile bottom tab bar (`< lg` / Android) so every role's primary action is reachable within 1–3 clicks.
- **Photosensitive-Safe Visual Alerts (`< 3 Hz`):** Alert pulse animations use a `1.2s` cycle (well below the 3 Hz threshold) and automatically disable under `prefers-reduced-motion`.
- **Multi-Modal `>= 3000 ms` Alert Cues (Never Sound-Only):** Every drill phase triggers synchronized visual banners, native/web haptics, and offline Web Audio tones lasting at least 3 seconds:
    - `dch` (Drop, Cover & Hold): **3200 ms** — 3 heavy pulses `[900, 250, 900, 250, 900]`
    - `evacuate` (Evacuate Now): **3350 ms** — 5 urgent alternating siren pulses `[550, 150, 550, 150, 550, 150, 550, 150, 550]`
    - `ended` (All Clear): **3000 ms** — 2 steady chime pulses `[1200, 600, 1200]`
- **Human-in-the-Loop Phase Transitions:** DCH timers never auto-advance to Evacuate; a Coordinator must manually confirm and advance phases to prevent ordering evacuation during active shaking.
- **Accessible Touch Targets & Contrast:** Standardized button primitives enforce `>= 48×48px` (`min-h-12`) primary touch targets and WCAG AA (`>= 4.5:1`) color contrast.
- **Camera-Broken Fallback:** Students who cannot scan an assembly QR code can enter the posted muster-point code manually (validated against campus assembly nodes) or be checked in via Peer/Teacher Assisted Check-In.
- **Role-Based Access Control (RBAC):** Firestore security rules (`hudyat/firestore.rules`) restrict drill control, roster imports, and verification writes to authorized roles.

---

## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS (pure JavaScript / JSX — zero TypeScript)
- **Backend & Real-Time Sync:** Firebase Authentication & Cloud Firestore
- **Mobile Wrapper:** Capacitor 8 (`@capacitor/android`, `@capacitor/haptics`, `@capacitor/local-notifications`, `@capacitor/app`)
- **Testing & Linting:** Vitest (`16/16` test files, `100/100` passing tests), ESLint (`0` errors, `0` warnings)
- **CI/CD:** GitHub Actions (automated test, lint, production build, and Android Debug APK artifact)

---

## Project Structure

```text
Hudyat/
├── .github/workflows/          # CI (test/lint/build) & Android Debug APK workflows
├── hudyat/
│   ├── android/                # Capacitor Android native project
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/          # Campus setup & QR sheet UI components
│   │   │   ├── auth/           # Login form card
│   │   │   ├── coordinator/    # Drill controls, phase tracker, CSV panels, reports
│   │   │   ├── layout/         # AppShell subcomponents (SidebarNav, MobileBottomNav, NavConfig)
│   │   │   ├── student/        # Alert cards, DCH confirmation, QR/manual check-in, route & SOS UI
│   │   │   ├── teacher/        # Expected list, headcount tables, SOS alert list, assisted check-in
│   │   │   ├── ui/             # Standardized primitives (Button, Card, StatusBadge, ErrorBanner, etc.)
│   │   │   ├── ActiveDrillWatcher.jsx
│   │   │   ├── AppShell.jsx
│   │   │   ├── QrCameraScanner.jsx
│   │   │   └── SosSheet.jsx
│   │   ├── data/               # Interactive demo datasets (headcount, check-in, assisted)
│   │   ├── firebase/           # Firebase & Firestore client initialization
│   │   ├── pages/              # 14 modular page orchestrators (zero inline UI blocks)
│   │   ├── routes/             # RoleRouter, AuthContext, and session hooks
│   │   ├── services/           # Drill, Alert, Sound, Vibration, LocalNotification, QR, Routing, Headcount, SOS
│   │   ├── App.jsx
│   │   └── index.css           # Design tokens & standardized .hudyat-* classes
│   ├── tests/                  # 16 Vitest unit test suites (100 passing tests)
│   ├── firestore.rules         # Role-based Firestore security rules
│   ├── capacitor.config.*      # Capacitor Android configuration
│   ├── .env.example            # Template for Firebase environment variables
│   └── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** `v22+` and **npm** `v10+`
- A **Firebase project** with Email/Password Authentication and Cloud Firestore enabled

### Installation & Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/tirins00/Hudyat.git
   cd Hudyat/hudyat
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Copy `.env.example` to `.env` inside `hudyat/` and populate your Firebase project credentials:
   ```bash
   cp .env.example .env
   ```
   *(Never commit `hudyat/.env` to version control; it is excluded via `.gitignore`.)*

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open the local URL shown in your terminal (default: `http://localhost:5173`).

---

## Available Scripts

Run all commands from inside `hudyat/`:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Vite local development server. |
| `npm test` | Runs the full Vitest test suite (`16` files, `100` tests). |
| `npm run lint` | Runs ESLint across the codebase (`0` errors, `0` warnings). |
| `npm run build` | Builds the optimized production bundle into `hudyat/dist/`. |
| `npx cap sync android` | Copies `dist/` assets and syncs Capacitor plugins into `hudyat/android/`. |

---

## Android Build & Background Alert Setup

### Downloading the Debug APK

Every push to `main` triggers the **Android Debug APK** GitHub Actions workflow and publishes a downloadable **`hudyat-debug-apk`** artifact containing `app-debug.apk`.

### Device Configuration for Background Drill Alerts

HUDYAT uses `@capacitor/local-notifications` and `@capacitor/app` (with Android 13+ `POST_NOTIFICATIONS` permission and an `importance: 5` `hudyat-emergency` notification channel) to deliver heads-up notifications when minimized and automatically resume to `/student/alert` when reopened.

For reliable minimized background alerts on Android devices:
1. Install `app-debug.apk` and tap **Allow** when prompted for Notifications.
2. Open **Settings → Apps → Hudyat → App battery usage** and set it to **Unrestricted** (prevents Android from suspending the WebView socket while minimized).
3. Open **Settings → Apps → Hudyat → Notifications → Emergency Drill Alerts** and confirm **Pop on screen**, **Sound**, and **Vibration** are enabled.

---

## Testing & CI/CD

- **Unit Tests:** `16/16` Vitest suites (`100/100` tests) covering `AlertCoordinator`, `SoundService`, `VibrationService`, `LocalNotificationService`, `QrCodeParser`, `DrillService`, `CheckInService`, `HeadcountService`, `ScheduleResolver`, `SosService`, and graph/routing logic.
- **Static Analysis:** ESLint passes with `0` errors and `0` warnings.
- **GitHub Actions:** Automated CI validates tests, linting, and production builds on every push/PR, and compiles the Capacitor Android Debug APK on `main`.

---

## Known Limitations

- **Background / Force-Closed Push Alerts:** Minimized background alerts are supported via `@capacitor/local-notifications` when Android battery optimization is set to **Unrestricted**. Receiving alerts when the app is completely force-closed or during deep Doze mode requires server-triggered **Firebase Cloud Messaging (FCM)** and Cloud Functions, which is scoped as a future enhancement.
- **Schedule-Dependent Expected Headcount:** Real-time expected student counts are resolved dynamically against the live clock using imported `scheduleSlots`; if no class slot covers the active drill's day and time window, expected class attendance will display `0`.
- **Interactive Demo Fallback:** When Firebase `.env` credentials are absent, select monitoring screens (e.g., Headcount Board, Check-In) fall back to an interactive Demo Mode for preview and testing.
- **Pending Full-Scale Validation:** Automated unit tests cover core services (`100/100` passing), while Firestore Emulator rule tests, high-concurrency load tests, offline sync tests, and formal SUS usability surveys are scheduled for post-submission validation.
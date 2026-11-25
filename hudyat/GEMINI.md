# Hudyat — Project Rules

## Tech Stack
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, React Router
- **Backend / Cloud:** Firebase (Authentication, Cloud Firestore with offline persistence, Hosting)
- **Mobile:** Capacitor (Android)
- **Testing:** Vitest

## Architecture
- **No custom backend server.** The application is client-only against Firebase.
- All authorization and access control must be enforced via **Firestore Security Rules**.

## Firestore Collections
- `campuses/{campusId}`
  - Subcollections: `buildings`, `mapNodes`, `mapEdges`, `floorPlans`, `policy`
- `users/{uid}`
- `sections`
- `enrollments`
- `scheduleSlots`
- `drills/{drillId}`
  - Subcollections: `expectedEntries`, `responses`, `checkIns`, `alerts`, `sos`

## Constraints & Invariants

### Disallowed Features
- No GPS / geolocation tracking
- No biometrics
- No AI features
- No sound-only alerts (alerts must include non-audio visual/haptic cues)

### Accessibility & Safety
- Flashing alerts must stay **under 3 flashes/sec**
- Minimum color contrast ratio: **4.5:1**
- Minimum touch target size: **48×48px**

### Data & Routing Rules
- Check-in documents must use **`doc ID = studentUid`**
- Lift edges (**`isLift: true`**) are **always excluded** from evacuation/navigation routes

## Verification Commands
- Build: `npm run build`
- Run tests: `npx vitest run`

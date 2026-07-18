# Moame

A personal AI agent for job-application automation, email management, and
reminders, running as an Android app on your phone.

## What this is (and isn't)

Moame is a fully **on-device** Android app - no backend server. That was a
deliberate choice, with real trade-offs worth understanding before you rely
on it:

- **Background sync is periodic, not truly continuous.** Android's
  WorkManager enforces a hard 15-minute floor on periodic background work,
  and Doze/App Standby can delay it further depending on battery state and
  usage patterns. The default interval is 30 minutes (configurable down to
  15 in Settings). This is the realistic ceiling for a backend-less agent -
  it is not instant push notification.
- **LinkedIn and Indeed are manual-assist only, always.** Both platforms'
  Terms of Service prohibit automated/bot applications, and neither exposes
  a public API for job search or applying. Moame will find/score listings
  you paste in from those sites and tailor a resume/cover letter for them,
  but it never scrapes them and never submits to them unattended -
  regardless of match confidence or the auto-apply setting. See
  `core/src/main/kotlin/com/moame/core/model/JobListing.kt`
  (`automationPolicy()`) and
  `app/src/main/kotlin/com/moame/app/accessibility/AtsAutoFillAccessibilityService.kt`,
  which hard-codes these two domains into `DISALLOWED_HOST_SUFFIXES` as a
  defense-in-depth check.
- **Full auto-apply is supported for ATS-based sources**: Greenhouse,
  Lever, Workday (structured, public/unauthenticated job APIs - not
  scraping), and Adzuna (an official job-search API, needs a free
  app_id/app_key). This is off by default (Settings -> Auto-apply); even
  when on, only listings scoring above `SyncWorker.HIGH_CONFIDENCE_THRESHOLD`
  (75%) are auto-submitted, everything else is queued for your review.
- **Nothing sends or submits without your knowledge.** Auto-sent emails and
  auto-submitted applications are always logged (`action_log` table /
  Dashboard "Recent activity"), and you can turn auto-submit off entirely.

## Building this project

This repo was built inside a sandbox **without an Android SDK** (no
`ANDROID_HOME`, no `dl.google.com` access), so the Android app module
(`:app`) could never be compiled or run here. What *was* verified here:

```
gradle :core:test
```

`:core` is a plain Kotlin/JVM module (job matching, email classification,
urgency/reminders, Claude API client, resume tailoring) with no Android
dependency, and its unit tests pass (16 tests across `JobMatcherTest`,
`EmailClassifierTest`, `UrgencyEngineTest`).

To build and run `:app` on your OPPO Find X9 Pro:

1. Install **Android Studio** (Ladybug or newer) with Android SDK
   Platform 35 and a device/emulator running API 26+ (this targets
   `minSdk = 26`, `targetSdk = 35`).
2. Open this repo's root folder in Android Studio and let it sync -
   `:app`'s Gradle config needs `dl.google.com` (Google's Maven repo),
   which isn't reachable from wherever this was authored.
3. Connect your phone via USB (enable Developer Options -> USB debugging)
   or use a Wi-Fi ADB connection, then Run.

### Required setup before first use

- **Anthropic API key** (Settings screen): used for resume/cover-letter
  tailoring and email summarization/drafting. Get one at
  console.anthropic.com.
- **Gmail**: tap "Connect Gmail" in Settings. You'll need a Google Cloud
  project with the Gmail API enabled and an OAuth 2.0 Android client ID
  (package name `com.moame.app` + your debug/release SHA-1) registered in
  Google Cloud Console - Moame never bundles a shared client ID.
- **Job sources** (Settings screen): add Greenhouse board tokens / Lever
  company slugs (from those companies' own public careers page URLs -
  e.g. `boards.greenhouse.io/acme` -> token `acme`) for companies you
  actually want auto-apply against, and/or enable Adzuna with a free
  app_id/app_key from developer.adzuna.com.
- **Accessibility service** (only if you want ATS auto-fill): enable
  "Moame ATS Auto-Fill" in Android Settings -> Accessibility. It only
  activates on greenhouse.io/lever.co/myworkday.com pages and is a
  best-effort field-matcher (matches visible label/hint text against known
  field names) - it will not work on every form layout, and it never taps
  a final Submit button unless the profile-level auto-apply setting is also on.

## Architecture

```
core/   Pure Kotlin/JVM - no Android dependency, unit-testable here.
  model/       Profile, JobListing, JobApplication, EmailItem, Reminder
  matching/    JobMatcher - deterministic, explainable job/profile scoring
  email/       EmailClassifier - deterministic category/urgency rules
  reminder/    UrgencyEngine - urgency + recommended action from due dates
  ai/          ClaudeClient, ResumeTailoringService, EmailAssistService

app/    Android app (Kotlin, Jetpack Compose, Hilt, Room, WorkManager)
  data/db/          Room entities/DAOs/database
  data/repository/  Repositories bridging Room <-> core models, Settings
  profile/          SeedProfile (sample profile from an example CV)
  gmail/            Gmail OAuth + read/send/label via the Gmail API
  jobsource/        Greenhouse/Lever/Workday/Adzuna connectors + aggregator
                     + LinkedIn/Indeed manual-assist intake
  work/             SyncWorker (periodic background pass) + scheduling
  accessibility/    ATS auto-fill AccessibilityService (scoped, opt-in)
  notification/     Notification channels/helpers
  ui/               Compose screens: Dashboard, Applications, Emails,
                     Reminders, Settings
```

`SyncWorker` is the periodic entry point: it fetches/classifies new email,
fetches/scores new job listings from configured ATS sources, tailors
resume/cover letter via Claude for matches, and either auto-submits
(if enabled, ATS-eligible, and high-confidence) or queues the application
and notifies you.

## Your profile

The app seeds a sample profile (`app/.../profile/SeedProfile.kt`) built
from an example CV (Contracts & Procurement Engineer, oil & gas/EPC). Edit
it directly in that file, or replace it via the Room-backed
`ProfileRepository` - nothing in the matching/classification/tailoring
logic is specific to that field; a Profile is just skills + experience +
preferences, and the same pipeline works for any specialty.

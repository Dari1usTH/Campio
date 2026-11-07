# Campio frontend roadmap

- [x] Design system tokens, fonts, dark theme, i18n (ro)
- [x] Logo (full/mark/mono), favicon, OG image
- [x] Data layer: zod types, mock services, query options (VITE_API_URL)
- [x] Shared components: Button variants, Chip, Card, ScoreGauge, StepProgress, OtpInput, CopyButton, BottomSheet, illustrations, cookie banner
- [x] Landing page
- [x] Auth: signup, login, verify-2fa, forgot, reset
- [x] App shell: sidebar / collapsed / top tabs / bottom tab bar + FAB, notifications
- [x] Wizard /app/new
- [x] Generating screen
- [x] Campaign result (9 sections)
- [x] Results + next steps
- [x] Dashboard
- [x] History + compare + share link
- [x] Assets, Settings
- [x] Tests for scoring formula / defaults, responsive check

Implementation notes:

- Frontend completed on the existing TanStack Start project; services remain demonstrative until the backend is connected.
- Posters/video and the authenticator QR remain intentionally marked placeholders as specified.
- Responsive Chromium QA: 375, 430, 768, 1024, 1280, 1536 px; additional foldable/landscape checks at 540, 844, 1080 px.
- PDF export uses the browser print dialog. Read-only sharing uses a validated campaign snapshot in the URL fragment.
- English translation can be added to the existing Romanian dictionaries; English UI is not enabled yet.

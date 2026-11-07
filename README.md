# Campio

Frontend în română pentru crearea și urmărirea campaniilor de marketing. Continuă proiectul Lovable existent, cu React 19, TypeScript, TanStack Start/Router, TanStack Query, Tailwind CSS 4, React Hook Form și Zod.

## Pornire

```sh
npm install
npm run dev
```

Vite afișează adresa locală în terminal. Pentru verificare:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

## Ce este implementat

- Landing, logo SVG, favicon și imagine Open Graph.
- Înscriere, login, verificare OTP, coduri de rezervă, recuperare și resetare parolă.
- Dashboard, notificări, onboarding și calendarul acțiunilor.
- Creator cu 4 pași: descriere, extragere/editare produs, fotografie, canale, buget, obiectiv, ton și rezumat.
- Generare simulată cu progres, scoruri și tranziție la campanie.
- Raport cu 9 secțiuni, reacții simulate, avertismente, plan de buget, texte copiabile și vizual PNG 1080×1080.
- Lansare, salvare, export prin dialogul de imprimare/PDF și link cu o copie a campaniei, doar pentru citire.
- Rezultate reale introduse manual, comparație estimat/real și sugestii calculate din cifrele introduse.
- Istoric cu căutare, filtre, compararea a două campanii și refolosirea setărilor.
- Biblioteca de vizuale, profil, securitate, integrări, notificări, temă luminoasă/întunecată și brand kit.
- Navigație adaptată la desktop, laptop, tabletă și mobil, acord cookie și mișcare redusă.

Posterele și videourile sunt marcate „În curând”, conform specificației.

## Demonstrație locală

Fără `VITE_API_URL`, serviciile din `src/services/` folosesc date mock tipizate și latență simulată. Campaniile, setările și sesiunea demonstrativă se păstrează în browser. Interfața indică explicit modul demo. Nu există apeluri AI reale, trimitere de email, autentificare Google sau integrări externe active.

Poți deschide `/app` direct pentru explorare. Pentru fluxul de autentificare:

- Orice email valid și o parolă de minimum 8 caractere permit înscrierea demo.
- OTP: orice cod cu exact 6 cifre, în afară de `000000`.
- Login: parola `gresit` demonstrează eroarea de autentificare.
- Emailul `taken@example.com` demonstrează eroarea de cont existent la înscriere.
- Resetare: `/reset-password?token=demo` este valid; `expired` și `invalid` arată stările corespunzătoare.

Linkul de distribuire conține în fragment o copie validată a campaniei; funcționează fără datele locale ale autorului. Nu include sesiunea sau fotografia încărcată, iar modificările ulterioare nu se sincronizează. Găzduirea aplicației este necesară pentru distribuirea în afara calculatorului local.

## Conectarea backendului

Copiază `.env.example` în `.env.local` și configurează `VITE_API_URL` cu originea API, fără slash final. Nu introduce chei secrete în variabile `VITE_*` — sunt expuse browserului.

Toate operațiile sunt centralizate în servicii, cu tipuri și scheme Zod în `src/services/schemas.ts`. API-ul trebuie să permită originea frontendului prin CORS. Contractele principale sunt:

| Serviciu          | Endpointuri                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Autentificare     | `POST /auth/signup`, `/auth/login`, `/auth/google`, `/auth/2fa/method`, `/auth/2fa/resend`, `/auth/2fa/verify`, `/auth/logout` |
| Recuperare parolă | `POST /auth/forgot`, `GET /auth/reset/validate?token=...`, `POST /auth/reset`                                                  |
| Produse           | `POST /wizard/parse`                                                                                                           |
| Campanii          | `GET/POST /campaigns`, `GET/PATCH/DELETE /campaigns/:id`                                                                       |
| Generare          | `GET /campaigns/:id/generation`                                                                                                |
| Progres           | `POST /campaigns/:id/warnings/:warningId/toggle`, `POST /campaigns/:id/channels/:channelId/actions/:actionId/toggle`           |
| Rezultate         | `POST /campaigns/:id/results`, `GET /campaigns/:id/results/analysis`                                                           |
| Notificări        | `GET /notifications`, `POST /notifications/read`                                                                               |
| Setări            | `GET/PATCH /settings`, `POST /settings/password`, `DELETE /settings/account`                                                   |

Autentificarea și autorizarea reale, verificarea OAuth/OTP, stocarea fișierelor și publicarea pe platforme trebuie implementate pe server. Interfața pentru autentificator afișează intenționat un substituent QR, nu un secret TOTP real. Politicile legale demonstrative trebuie înlocuite înainte de lansarea serviciului. Costurile și estimările afișate sunt date demonstrative.

Textele comune sunt în `src/i18n/ro.ts`; textele suplimentare ale modulelor sunt în fișiere `copy.ts`, pregătite pentru o traducere ulterioară. Tailwind 4 folosește tokenurile din `src/styles.css`, fără un fișier de configurare Tailwind separat.

## Verificări

Testele acoperă rutarea, formula scorului, extragerea produsului, monedele, bugetele, relevanța datelor mock și validarea copiilor distribuite. Interacțiunile principale sunt verificate suplimentar în Chromium la 375, 430, 768, 1024, 1280 și 1536 px. Pentru export PDF, folosește „Exportă PDF”, apoi „Salvează ca PDF” în dialogul browserului.

Proiectul rămâne compatibil cu editorul [Lovable](https://lovable.dev/projects/2a62b99d-2edd-4c56-81da-41d193eed6bf). Nu sunt modificate migrații, secrete sau istoric Git publicat.

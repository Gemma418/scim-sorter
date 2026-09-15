# Roller Derby Scrim Sorter

A small open-source web app for organising scrim signups into two balanced teams, with standby skaters included when needed.

## Local development

From the project folder:

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Then open:

```text
http://127.0.0.1:5173/
```

This host binding is required in this environment because the default `localhost` binding can fail with an IPv6 permission error on some local setups.

## Production build

```bash
npm run build
```

The built files will be generated in the `dist` folder.

## App goals

The app is designed to:

- read roster data from a Google Sheet or CSV export
- validate rows before processing
- split skaters into two teams of 15
- add up to 5 extras as standby
- respect scrim-level skill preferences and minimum role coverage
- balance skill and experience across both teams

## Current status

This is an initial working scaffold. The default starter UI is in place while the scrim organiser logic is being implemented.

## Notes

- This project uses Vite + React + TypeScript.
- It is intentionally lightweight and open-source-first, so the first implementation focuses on a client-side workflow that can later be extended to a backend or Google Sheets API integration.

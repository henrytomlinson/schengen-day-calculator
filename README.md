# Schengen 90/180 Day Calculator

**Live app:** https://schengen-day-calculator.vercel.app

A privacy-friendly, mobile-responsive calculator for planning visa-free short stays in the Schengen Area. Enter previous visits and a planned trip to see:

- days used before the planned arrival;
- days available in the rolling window;
- whether every day of the planned trip complies;
- the maximum continuous stay from the selected arrival; and
- the earliest eligible entry date for one day or for the full planned trip.

All calculations run in the browser. Dates are not uploaded or stored.

## How the calculation works

The standard rule allows up to **90 days in any rolling 180-day period**. Entry and exit dates both count. For each day of a proposed visit, the app:

1. opens a 180-day window ending on that day;
2. merges overlapping travel ranges so a calendar day is never counted twice;
3. counts all Schengen presence days in the window, including the proposed visit; and
4. marks the plan non-compliant if the total exceeds 90 on any day.

Calendar dates are converted to integer UTC days to avoid timezone and daylight-saving errors.

This is a planning aid, not legal advice. The European Commission's [official short-stay calculator](https://home-affairs.ec.europa.eu/policies/schengen/border-crossing/short-stay-calculator_en) should be used for confirmation, and border authorities make the final decision.

## Run locally

Requirements: Node.js 20 or later.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Test and build

```bash
npm test
npm run build
```

The production files are generated in `dist/`.

## Deployment

The repository is connected to Vercel. Every push to `main` automatically creates a new production deployment; pull requests receive preview deployments.

## Technology

- React
- TypeScript
- Vite
- Vitest

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:
* npm install next react react-dom


```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

pickEmTracker/
├─ app/
│  ├─ components/
│  │  ├─ PickEmBoard.tsx      <-- update this to use the hook
│  │  └─ Page.tsx
│  ├─ page.tsx
│  ├─ layout.tsx
│  └─ globals.css
├─ app/api/
│  └─ scoreboard/
│     └─ route.ts             <-- NEW: app router API endpoint
│     └─ UseScoreboard.ts
├─ public/
├─ next.config.ts
├─ package.json
└─ tsconfig.json


app/
 ├─ page.tsx          <- your main PickemTracker page
 ├─ all-matchups/
 │   └─ page.tsx      <- new page showing all matchups
components/
 ├─ PickemTracker.tsx
 └─ Card.tsx
hooks/
 └─ useScoreboard.ts

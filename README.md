# Dynasty League 🏀

Free-to-play online basketball franchise simulator. Build your dynasty.

## Quick Start

```bash
cd frontend
cp .env.example .env   # Add your Firebase config
npm install
npm run dev
```

## Deploy to Vercel

1. Create a Firebase project (enable Auth + Firestore)
2. Copy your Firebase config to `.env`
3. Run `npx vercel` from the `frontend` directory

## Tech Stack

- **Frontend**: React + Tailwind CSS (mobile-first)
- **Backend**: Firebase Auth + Firestore
- **Hosting**: Vercel (static SPA)

## Features

- Create/manage leagues and teams
- Draft players and build rosters
- Simulate seasons (weekly or full)
- Trade with AI analysis
- AI-powered lineup optimization, draft recommendations, scouting
- Auto-generated league news and stories
- Cosmetic store (no pay-to-win)
- Dynasty history tracking

# Kaam Ki Baat — OmniDEL.ai

Voice-first, photo-driven daily work management for India's blue-collar workforce.

## What It Does

- **Captains** assign tasks by speaking in Hindi/Bangla — AI creates and assigns them
- **Workers** accept tasks, submit progress photos + voice updates throughout the day
- **AI** scores work quality (0-10) at end of day
- **Captains** review scores → scores map to transparent payment

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind + shadcn-ui
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **AI:** Google Gemini 2.5 Flash (transcription, conversation, scoring)
- **TTS:** Google Cloud Text-to-Speech (Hindi/Bangla/English)
- **Deploy:** Vercel (frontend)

## Getting Started

```sh
# Clone the repo
git clone https://github.com/Rambadrinathan/kaam-ki-baat.git
cd kaam-ki-baat

# Install dependencies
npm install

# Start dev server
npm run dev
```

App runs at `http://localhost:8080`

## Environment Variables

Create a `.env` file:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

Supabase Edge Function secrets (set via Supabase dashboard):
```
GEMINI_API_KEY=your_google_ai_studio_key
GOOGLE_CLOUD_TTS_API_KEY=your_google_cloud_tts_key
```

## Project Structure

```
src/
├── components/     # UI components (shadcn + custom)
├── hooks/          # Auth, language, mobile detection
├── integrations/   # Supabase client
├── pages/          # Route pages (captain, worker, admin, groups)
└── utils/          # i18n translations (EN/HI/BN)

supabase/
├── functions/      # Edge Functions (AI + TTS)
└── migrations/     # Database schema
```

## Part of KarmYog Group

Built by [KarmYog for 21st Century](https://www.karmyog21c.in) — making blue-collar work visible, measurable, and connected to growth.

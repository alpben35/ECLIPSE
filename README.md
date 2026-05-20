# Eclipse — AI-Powered Schoolwork Tutor & Progress Tracker

Eclipse is a full-stack web application designed to supercharge classroom and individual learning. It features an AI-powered tutor for students (from Year 1 through University), automated schoolwork diagnostic generation, real-time student group management, class progress tracking for teachers, and local Stripe subscription checkouts.

---

## Technical Stack

- **Frontend**: React 18+ with TypeScript, styled with Tailwind CSS and animated using `motion/react`.
- **Backend**: Node.js & Express server with TypeScript.
- **AI Integration**: Powered by the Gemini API via server-side endpoints (`/api/tutor/ask-stream`).
- **Database & Auth**: Google Firebase (Firestore and Firebase Authentication) for user state, profiles, and classroom progress tracking.
- **Payments**: Stripe Checkout and Subscription lifecycle.

---

## Getting Started

### 1. Prerequisites
Ensure you have **Node.js** (v18 or higher) and **npm** installed on your machine.

### 2. Dependencies
To install the initial dependencies, run:
```bash
npm install
```

### 3. Environment Setup (`.env`)
Eclipse requires several API keys to run successfully. Copy `.env.example` into a actual `.env` file:
```bash
cp .env.example .env
```
Open `.env` and fill in your keys:
- `GEMINI_API_KEY`: Your Gemini API Key from Google AI Studio.
- `STRIPE_SECRET_KEY` & `STRIPE_PRICE_ID_PREMIUM`: Stripe API details for payment setups.

### 4. Running the App locally

Start the Express and Vite development server:
```bash
npm run dev
```
Open `http://localhost:3000` to view the application.

---

## Production Build & Deploy

Compile both the client-side SPA bundle and server code into `dist/`:
```bash
npm run build
```
Launch the compiled standalone server:
```bash
npm start
```

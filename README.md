# Eclipse AI Tutor

**Homework help, clear explanations and revision practice.**

[![Eclipse AI tutor: Big questions. Brighter minds.](https://eclipseapp.co.uk/eclipse-share.png)](https://eclipseapp.co.uk/?utm_source=github&utm_medium=referral&utm_campaign=readme)

## Try Eclipse online

**[Start learning free →](https://eclipseapp.co.uk/?utm_source=github&utm_medium=referral&utm_campaign=readme)**

Use the hosted app without downloading or configuring this repository. The free plan includes **15 AI prompts per day**. An account is required to use the tutor.

- **Understand:** explore explanations and ask follow-up questions.
- **Work through a problem:** bring a question to Solve mode.
- **Practise and revise:** try questions and review what you have learned.
- **See your progress:** keep track of your learning in the app.

### Read a free worked example

[Explore fractions, photosynthesis and metaphors →](https://eclipseapp.co.uk/homework-help.html?utm_source=github&utm_medium=referral&utm_campaign=readme)

The guide is free to read without an account. It includes practice questions and expandable answers.

### Plans

Start free, then [compare plans](https://eclipseapp.co.uk/subscription?utm_source=github&utm_medium=referral&utm_campaign=readme) if you need a larger daily prompt allowance. Review the current prices and recurring payment terms before subscribing.

AI can make mistakes. Check important answers with your teacher or course materials, and follow your school’s rules for AI use.

---

## Developer documentation

Eclipse is a full-stack application with student tutoring, progress tracking and a teacher portal. The instructions below are for running the source locally. They are not required to use the hosted app.

## Technical Stack

- **Frontend**: React 18+ with TypeScript, styled with Tailwind CSS and animated using `motion/react`.
- **Backend**: Node.js & Express server with TypeScript.
- **AI Integration**: Powered by the Gemini API via server-side endpoints (`/api/tutor/ask-stream`).
- **Database & Auth**: Google Firebase (Firestore and Firebase Authentication) for user state, profiles, and classroom progress tracking.
- **Payments**: Stripe Checkout and Subscription lifecycle.

---

## Getting Started

### 1. Prerequisites
Ensure you have **Node.js 22** and **npm** installed on your machine.

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

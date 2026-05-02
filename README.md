# learn-stack
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/6f4b9dca-7d74-4cbf-90f0-b5ed267cfed8

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Copy `.env` to `.env.local` and fill in your API keys:
   ```bash
   cp .env .env.local
   ```
3. Set your API keys in `.env.local`:
   - `GEMINI_API_KEY`: Get from [Google AI Studio](https://aistudio.google.com/)
   - Firebase keys: Get from your Firebase project settings
4. Run the app:
   `npm run dev`

## Deploy to Vercel

1. **Push to GitHub** (make sure `.env.local` is in `.gitignore`)
2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will automatically detect the `vercel.json` configuration

3. **Set Environment Variables in Vercel**:
   - Go to your project settings in Vercel
   - Add these environment variables:
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_AUTH_DOMAIN`
     - `VITE_FIREBASE_PROJECT_ID`
     - `VITE_FIREBASE_STORAGE_BUCKET`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID`
     - `VITE_FIREBASE_APP_ID`
     - `VITE_FIREBASE_DATABASE_ID`
     - `GEMINI_API_KEY`

4. **Deploy**: Vercel will automatically build and deploy your app

## API Keys Setup (🔒 Security First!)

**⚠️ IMPORTANT:** Never commit real API keys to GitHub!

### 1. Environment Variables

Copy the template and add your real API keys:

```bash
cp .env .env.local
```

Then edit `.env.local` with your actual keys:
- **Gemini API Key**: Get from [Google AI Studio](https://aistudio.google.com/)
- **Firebase Keys**: Get from your Firebase project settings

### 2. Firebase Configuration

Your Firebase config is now loaded from environment variables. The `firebase-applet-config.json` file is excluded from Git and should never be committed.

### 3. Security Check

Before pushing to GitHub, verify:
- ✅ `.env.local` is in `.gitignore`
- ✅ `firebase-applet-config.json` is in `.gitignore`
- ✅ Only `.env` (with placeholders) is committed
- ✅ `.env.local` contains real API keys (never committed)

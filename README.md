# AI Image Generator

Modern AI image generation web app built with NextJS, powered by Cloudflare Workers AI.

![Preview](https://img.shields.io/badge/Next.js-14-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC)

## Features

- 🖼️ Generate 1-4 images simultaneously
- 🎨 Choose from 4 AI models (SDXL, FLUX, Lightning, DreamShaper)
- 🔄 Regenerate with one click
- ⬇️ Download generated images
- 🌙 Dark theme with glass-morphism design
- 📱 Fully responsive

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Cloudflare Workers AI API key

### Installation

```bash
# Clone the repo
git clone https://github.com/ZOO-Corp/image-generator.git
cd image-generator

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Run development server
npm run dev
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Cloudflare Workers AI Image Generation API
IMAGE_API_URL=https://your-worker.your-subdomain.workers.dev/
IMAGE_API_KEY=your-api-key-here
```

### Deploy to Vercel

1. Push to GitHub
2. Import repository on [vercel.com](https://vercel.com)
3. Add environment variables in Vercel dashboard:
   - `IMAGE_API_URL`  
   - `IMAGE_API_KEY`
4. Click Deploy

## API

### POST /api/generate

Generate images from text prompt.

```json
{
  "prompt": "A futuristic city at sunset",
  "model": "@cf/black-forest-labs/flux-1-schnell",
  "count": 1
}
```

### Available Models

| Model | Speed | Quality |
|-------|-------|---------|
| SDXL Base 1.0 | Medium | High |
| FLUX.1 Schnell | Fast | High |
| SDXL Lightning | Very Fast | Medium |
| DreamShaper 8 | Fast | Medium |

## Tech Stack

- [Next.js 14](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [TailwindCSS](https://tailwindcss.com/) - Styling
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) - Image generation

## License

MIT

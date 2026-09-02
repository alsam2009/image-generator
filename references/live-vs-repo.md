# Image Generator (alsam2009/image-generator)

Local dev project matching live Vercel app at https://imagegenerator-swart.vercel.app/

## Live vs Repo mismatch
The GitHub repo has stale code. The Vercel deployment has newer features. Always:
1. Check the live site FIRST via web_extract or screenshots
2. Compare locally before assuming what's in the repo
3. Match the live version exactly — user will verify against screenshots

## Key differences (live vs initial clone)
- 3 models only (SDXL Base 1.0, SDXL Lightning, DreamShaper 8) — NO FLUX
- SDXL Base 1.0 is default (not FLUX)
- Advanced section with 2-column layout:
  - Left: Negative Prompt + Seed (with Random Seed button)
  - Right: Steps slider + Guidance slider
- Size options include HD/Full HD/2K/Max variants
- Favicon from live site (different from Next.js default)

## UI rules (from user feedback)
- Button: "▼ Hide" when expanded, "▼ Advanced" when collapsed (arrow ALWAYS ▼, never rotates)
- NO auto-starting dev server without explicit permission
- Match layout EXACTLY from screenshots — user provides reference images

## Environment
- Requires IMAGE_API_URL and IMAGE_API_KEY in .env
- API endpoint: POST /api/generate → polls task via GET /api/generate?taskId=
- Worker deployed at: https://free-generate-image.den-fstack.workers.dev/

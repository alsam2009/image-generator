import { NextResponse } from 'next/server';

const AVAILABLE_MODELS = [
  {
    id: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    name: 'SDXL Base 1.0',
    description: 'Stable Diffusion XL — высокое качество, детализированные изображения',
    speed: 'Medium',
    quality: 'High',
  },
  {
    id: '@cf/black-forest-labs/flux-1-schnell',
    name: 'FLUX.1 Schnell',
    description: 'FLUX от Black Forest Labs — быстрая генерация, отличное качество',
    speed: 'Fast',
    quality: 'High',
  },
  {
    id: '@cf/bytedance/stable-diffusion-xl-lightning',
    name: 'SDXL Lightning',
    description: 'Молниеносная генерация — 1 шаг вместо 20',
    speed: 'Very Fast',
    quality: 'Medium',
  },
  {
    id: '@cf/lykon/dreamshaper-8-lcm',
    name: 'DreamShaper 8',
    description: 'Художественный стиль, отлично для концепт-арта',
    speed: 'Fast',
    quality: 'Medium',
  },
];

export async function GET() {
  return NextResponse.json({ models: AVAILABLE_MODELS });
}

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const API_URL = process.env.IMAGE_API_URL || 'https://free-generate-image.den-fstack.workers.dev/';
const API_KEY = process.env.IMAGE_API_KEY || '';

export async function POST(request: NextRequest) {
  console.log('=== POST /api/generate ===');
  console.log('API_URL:', API_URL);
  console.log('API_KEY:', API_KEY ? 'SET(' + API_KEY.substring(0, 8) + '...)' : 'EMPTY');

  try {
    const body = await request.json();
    const prompt = body.prompt;
    const model = body.model || '@cf/stabilityai/stable-diffusion-xl-base-1.0';
    const count = Math.min(Math.max(body.count || 1, 1), 4);
    const width = body.width || 1024;
    const height = body.height || 1024;

    console.log('Request:', JSON.stringify({ prompt: (prompt || '').substring(0, 50), model, count, size: width + 'x' + height }));

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Generate all images in parallel, wait for results, return directly to client
    const promises = Array.from({ length: count }, () =>
      fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt.trim(), model, width, height }),
      })
    );

    const results = await Promise.allSettled(promises);
    const images: { url: string; success: boolean; error?: string }[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const response = result.value;
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          images.push({ url: 'data:image/png;base64,' + base64, success: true });
        } else {
          const errorText = await response.text();
          images.push({ url: '', success: false, error: 'API ' + response.status + ': ' + errorText });
        }
      } else {
        const errorMsg = result.reason?.message || String(result.reason) || 'Unknown fetch error';
        images.push({ url: '', success: false, error: errorMsg });
      }
    }

    const successCount = images.filter(i => i.success).length;
    console.log('Result: ' + successCount + '/' + count + ' images generated');

    return NextResponse.json({ images });
  } catch (error) {
    console.error('POST error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

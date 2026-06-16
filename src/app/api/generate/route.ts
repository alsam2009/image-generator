import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const API_URL = process.env.IMAGE_API_URL || 'https://free-generate-image.den-fstack.workers.dev/';
const API_KEY = process.env.IMAGE_API_KEY || '';

const tasks = new Map();

setInterval(() => {
  const now = Date.now();
  tasks.forEach((task, id) => {
    if (now - task.createdAt > 300000) tasks.delete(id);
  });
}, 300000);

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

async function processTask(taskId: string, prompt: string, model: string, count: number, width: number, height: number) {
  const task = tasks.get(taskId);
  if (!task) return;

  task.status = 'processing';
  console.log('[' + taskId + '] Processing ' + count + ' image(s), key=' + (API_KEY ? 'SET(' + API_KEY.substring(0,8) + '...)' : 'EMPTY'));

  try {
    const promises = Array.from({ length: count }, () =>
      fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, model, width, height }),
      })
    );

    const results = await Promise.allSettled(promises);
    const images = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const response = result.value;
        if (response.ok) {
          const blob = await response.blob();
          const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64');
          images.push({ url: 'data:image/png;base64,' + base64, success: true });
        } else {
          const errorText = await response.text();
          images.push({ url: '', success: false, error: 'API ' + response.status + ': ' + errorText });
        }
      } else {
        images.push({ url: '', success: false, error: result.reason?.message || 'Failed' });
      }
    }

    task.images = images;
    task.status = images.some(i => i.success) ? 'done' : 'error';
    console.log('[' + taskId + '] Done: ' + images.filter(i => i.success).length + '/' + count);
  } catch (error) {
    task.status = 'error';
    task.images = [{ url: '', success: false, error: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) }];
    console.error('[' + taskId + '] Error:', error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error));
  }
}

export async function POST(request: NextRequest) {
  console.log('=== POST /api/generate ===');
  console.log('API_URL:', API_URL);
  console.log('API_KEY:', API_KEY ? 'SET(' + API_KEY.substring(0,8) + '...)' : 'EMPTY');

  try {
    const body = await request.json();
    const { prompt, model = '@cf/stabilityai/stable-diffusion-xl-base-1.0', count = 1, width = 1024, height = 1024 } = body;

    console.log('Request:', JSON.stringify({ prompt: (prompt || '').substring(0, 50), model, count, size: width + 'x' + height }));

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (count < 1 || count > 4) {
      return NextResponse.json({ error: 'Count must be between 1 and 4' }, { status: 400 });
    }

    const taskId = generateId();
    console.log('Created task:', taskId);

    tasks.set(taskId, {
      status: 'pending',
      images: [],
      prompt: prompt.trim(),
      model,
      createdAt: Date.now(),
    });

    processTask(taskId, prompt.trim(), model, count, width, height);

    return NextResponse.json({ taskId, status: 'pending' });
  } catch (error) {
    console.error('POST error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json({ error: 'taskId required' }, { status: 400 });
  }

  const task = tasks.get(taskId);

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  return NextResponse.json({
    taskId,
    status: task.status,
    images: task.images,
    prompt: task.prompt,
    model: task.model,
  });
}

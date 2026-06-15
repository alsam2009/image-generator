import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const API_URL = process.env.IMAGE_API_URL || 'https://free-generate-image.den-fstack.workers.dev/';

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
  const apiKey = process.env['IMAGE_API_KEY'];
  console.log('[' + taskId + '] count=' + count + ' size=' + width + 'x' + height + ' key=' + (apiKey ? 'SET' : 'EMPTY'));
  try {
    const promises = Array.from({ length: count }, () =>
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Authorization': '***' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model, width, height }),
      })
    );
    const results = await Promise.allSettled(promises);
    const images = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const response = result.value;
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          images.push({ url: 'data:image/png;base64,' + base64, success: true });
        } else {
          const errorText = await response.text();
          images.push({ url: '', success: false, error: String(response.status) + ': ' + errorText });
        }
      } else {
        images.push({ url: '', success: false, error: String(result.reason) });
      }
    }
    task.images = images;
    task.status = images.some(i => i.success) ? 'done' : 'error';
    console.log('[' + taskId + '] ' + images.filter(i => i.success).length + '/' + count);
  } catch (error) {
    task.status = 'error';
    task.images = [{ url: '', success: false, error: String(error) }];
    console.error('[' + taskId + ']', String(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = body.prompt;
    const model = body.model || '@cf/stabilityai/stable-diffusion-xl-base-1.0';
    const count = body.count || 1;
    const width = body.width || 1024;
    const height = body.height || 1024;
    console.log('POST', String(prompt).substring(0, 50), model, count, width + 'x' + height);
    if (!prompt || !prompt.trim()) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    const taskId = generateId();
    tasks.set(taskId, { status: 'pending', images: [], prompt: prompt.trim(), model, createdAt: Date.now() });
    processTask(taskId, prompt.trim(), model, count, width, height);
    return NextResponse.json({ taskId, status: 'pending' });
  } catch (error) {
    console.error('POST error:', String(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get('taskId');
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 });
  const task = tasks.get(taskId);
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  return NextResponse.json({ taskId, status: task.status, images: task.images, prompt: task.prompt, model: task.model });
}

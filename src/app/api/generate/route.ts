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
  console.log(`[${taskId}] Processing ${count} image(s)`);

  try {
    if (!API_KEY) {
      throw new Error('API_KEY is not configured');
    }

    console.log(`[${taskId}] Sending request to ${API_URL}`);
    console.log(`[${taskId}] Payload:`, JSON.stringify({ prompt, model, width, height, count }));

    const promises = Array.from({ length: count }, () =>
      fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model,
          width,
          height
        }),
      })
    );

    const results = await Promise.allSettled(promises);
    const images = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const response = result.value;

        console.log(`[${taskId}] Response status: ${response.status}`);
        console.log(`[${taskId}] Content-Type: ${response.headers.get('content-type')}`);

        // ⚠️ ВАЖНО: ВСЕГДА читаем как ТЕКСТ, потом решаем что с ним делать
        const rawText = await response.text();
        console.log(`[${taskId}] RAW RESPONSE length:`, rawText.length);
        console.log(`[${taskId}] RAW RESPONSE (first 500 chars):`, rawText.substring(0, 500));

        if (response.ok) {
          let imageData = null;

          // Пробуем распарсить как JSON
          try {
            const json = JSON.parse(rawText);
            console.log(`[${taskId}] Parsed JSON keys:`, Object.keys(json));

            // ИЩЕМ ИЗОБРАЖЕНИЕ В ЛЮБОМ ПОЛЕ
            let base64String = null;

            // Проверяем все возможные поля
            const possibleFields = ['image', 'data', 'b64_json', 'output', 'result', 'images', 'url'];

            for (const field of possibleFields) {
              if (json[field]) {
                console.log(`[${taskId}] Found field '${field}'`);

                if (field === 'images' && Array.isArray(json[field]) && json[field].length > 0) {
                  base64String = json[field][0];
                  console.log(`[${taskId}] Got image from images array`);
                  break;
                } else if (field === 'output' && json[field].image) {
                  base64String = json[field].image;
                  console.log(`[${taskId}] Got image from output.image`);
                  break;
                } else if (field === 'result' && json[field].image) {
                  base64String = json[field].image;
                  console.log(`[${taskId}] Got image from result.image`);
                  break;
                } else if (typeof json[field] === 'string' && json[field].length > 100) {
                  base64String = json[field];
                  console.log(`[${taskId}] Got image from ${field}`);
                  break;
                }
              }
            }

            // Если нашли строку, пробуем сделать из нее изображение
            if (base64String && typeof base64String === 'string') {
              // Чистим от префиксов
              let clean = base64String;
              if (clean.includes(';base64,')) {
                clean = clean.split(';base64,')[1];
              }
              if (clean.startsWith('data:image')) {
                imageData = clean;
              } else {
                imageData = `data:image/png;base64,${clean}`;
              }

              console.log(`[${taskId}] ✅ SUCCESS! Image data length: ${imageData.length}`);
              console.log(`[${taskId}] First 50 chars:`, imageData.substring(0, 50));
            } else {
              // Если ничего не нашли, выводим ошибку
              console.error(`[${taskId}] ❌ No image found. Full response:`, JSON.stringify(json));
              images.push({
                url: '',
                success: false,
                error: `No image in response. Keys: ${Object.keys(json).join(', ')}`
              });
              continue;
            }
          } catch (parseError) {
            // Если это не JSON, пробуем как base64 строку
            console.log(`[${taskId}] Not JSON, trying as base64 string`);
            if (rawText.length > 100 && !rawText.includes('<')) {
              imageData = `data:image/png;base64,${rawText.trim()}`;
              console.log(`[${taskId}] Used as base64, length: ${rawText.length}`);
            } else {
              console.error(`[${taskId}] ❌ Invalid response format:`, rawText.substring(0, 200));
              images.push({
                url: '',
                success: false,
                error: `Invalid response: ${rawText.substring(0, 100)}`
              });
              continue;
            }
          }

          if (imageData) {
            images.push({ url: imageData, success: true });
            console.log(`[${taskId}] ✅ Image ${images.length} ready`);
          } else {
            images.push({ url: '', success: false, error: 'No image data' });
          }
        } else {
          console.error(`[${taskId}] API error: ${response.status}`, rawText);
          images.push({
            url: '',
            success: false,
            error: `API ${response.status}: ${rawText.substring(0, 100)}`
          });
        }
      } else {
        console.error(`[${taskId}] Request failed:`, result.reason);
        images.push({
          url: '',
          success: false,
          error: result.reason?.message || 'Request failed'
        });
      }
    }

    task.images = images;
    task.status = images.some(i => i.success) ? 'done' : 'error';

    const successCount = images.filter(i => i.success).length;
    console.log(`[${taskId}] Done: ${successCount}/${count} images`);

    if (successCount === 0) {
      console.error(`[${taskId}] All failed:`, images.map(i => i.error).join('; '));
    }

  } catch (error) {
    task.status = 'error';
    task.images = [{
      url: '',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }];
    console.error(`[${taskId}] Fatal error:`, error);
  }
}

export async function POST(request: NextRequest) {
  console.log('=== POST /api/generate ===');
  console.log('API_URL:', API_URL);
  console.log('API_KEY:', API_KEY ? `SET(${API_KEY.substring(0,8)}...)` : 'EMPTY');

  try {
    const body = await request.json();
    const {
      prompt,
      model = '@cf/black-forest-labs/flux-1-schnell',
      count = 1,
      width = 1024,
      height = 1024
    } = body;

    console.log('Request:', JSON.stringify({
      prompt: (prompt || '').substring(0, 50),
      model,
      count,
      size: `${width}x${height}`
    }));

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (count < 1 || count > 4) {
      return NextResponse.json({ error: 'Count must be between 1 and 4' }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({
        error: 'Server configuration error: API_KEY is not set'
      }, { status: 500 });
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
    console.error('POST error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json({ error: 'taskId required' }, { status: 400 });
  }

  const task = tasks.get(taskId);

  if (!task) {
    return NextResponse.json({ error: 'Task not found or expired' }, { status: 404 });
  }

  return NextResponse.json({
    taskId,
    status: task.status,
    images: task.images,
    prompt: task.prompt,
    model: task.model,
  });
}
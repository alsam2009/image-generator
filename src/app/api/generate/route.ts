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
  console.log(`[${taskId}] Processing ${count} image(s), key=${API_KEY ? 'SET(' + API_KEY.substring(0,8) + '...)' : 'EMPTY'}`);

  try {
    // Проверка наличия API_KEY
    if (!API_KEY) {
      throw new Error('API_KEY is not configured. Please set IMAGE_API_KEY environment variable.');
    }

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

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          let imageData = null;

          // Проверяем, что пришло - изображение или JSON
          if (contentType.includes('image')) {
            // Если API возвращает изображение напрямую
            try {
              const blob = await response.blob();
              const arrayBuffer = await blob.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              const mimeType = contentType.split(';')[0] || 'image/png';
              imageData = `data:${mimeType};base64,${base64}`;
              console.log(`[${taskId}] Image received as blob, size: ${blob.size} bytes`);
            } catch (error) {
              console.error(`[${taskId}] Error processing blob:`, error);
              images.push({
                url: '',
                success: false,
                error: `Failed to process image blob: ${error instanceof Error ? error.message : String(error)}`
              });
              continue;
            }
          } else {
            // Если API возвращает JSON
            try {
              const json = await response.json();
              console.log(`[${taskId}] API Response:`, JSON.stringify(json).substring(0, 200));

              // Пробуем разные форматы ответа
              if (json.image) {
                // Если в ответе есть поле image
                imageData = json.image.startsWith('data:') ? json.image : `data:image/png;base64,${json.image}`;
              } else if (json.data) {
                // Если в ответе есть поле data
                imageData = json.data.startsWith('data:') ? json.data : `data:image/png;base64,${json.data}`;
              } else if (json.url) {
                // Если в ответе URL на изображение
                imageData = json.url;
              } else if (json.b64_json) {
                // Если в ответе есть поле b64_json (как у OpenAI)
                imageData = `data:image/png;base64,${json.b64_json}`;
              } else if (json.output && json.output.image) {
                // Если в ответе есть output.image (как у некоторых API)
                imageData = json.output.image.startsWith('data:') ? json.output.image : `data:image/png;base64,${json.output.image}`;
              } else if (json.images && Array.isArray(json.images) && json.images.length > 0) {
                // Если в ответе массив изображений
                const firstImage = json.images[0];
                imageData = firstImage.startsWith('data:') ? firstImage : `data:image/png;base64,${firstImage}`;
              } else if (typeof json === 'string') {
                // Если ответ - просто строка base64
                imageData = `data:image/png;base64,${json}`;
              } else {
                // Если ничего не подошло - логируем ошибку
                console.error(`[${taskId}] Unknown response format:`, json);
                images.push({
                  url: '',
                  success: false,
                  error: `Unknown response format. Keys: ${Object.keys(json).join(', ')}`
                });
                continue;
              }
            } catch (error) {
              // Если JSON не парсится, пробуем прочитать как текст
              try {
                const text = await response.text();
                console.log(`[${taskId}] Response as text (first 200 chars):`, text.substring(0, 200));

                // Проверяем, может это base64 строка
                if (text.length > 100 && !text.includes('<') && !text.includes('{')) {
                  imageData = `data:image/png;base64,${text.trim()}`;
                } else {
                  images.push({
                    url: '',
                    success: false,
                    error: `Invalid response format: ${text.substring(0, 100)}`
                  });
                  continue;
                }
              } catch (textError) {
                images.push({
                  url: '',
                  success: false,
                  error: `Failed to parse response: ${error instanceof Error ? error.message : String(error)}`
                });
                continue;
              }
            }
          }

          if (imageData) {
            images.push({ url: imageData, success: true });
            console.log(`[${taskId}] Image processed successfully, data length: ${imageData.length}`);
          } else {
            images.push({ url: '', success: false, error: 'No image data received' });
          }
        } else {
          const errorText = await response.text();
          console.error(`[${taskId}] API error: ${response.status}`, errorText);
          images.push({
            url: '',
            success: false,
            error: `API ${response.status}: ${errorText}`
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
    console.log(`[${taskId}] Done: ${successCount}/${count} images successful`);

    if (successCount === 0) {
      console.error(`[${taskId}] All images failed. Errors:`, images.map(i => i.error).join('; '));
    }

  } catch (error) {
    task.status = 'error';
    task.images = [{
      url: '',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }];
    console.error(`[${taskId}] Fatal error:`, error instanceof Error ? error.message : String(error));
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

    // Запускаем обработку в фоне без await
    processTask(taskId, prompt.trim(), model, count, width, height);

    return NextResponse.json({ taskId, status: 'pending' });
  } catch (error) {
    console.error('POST error:', error instanceof Error ? error.message : String(error));
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
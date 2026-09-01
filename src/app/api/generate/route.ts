import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const AGNES_API_URL = 'https://apihub.agnes-ai.com/v1/images/generations';
const CF_API_URL = process.env.IMAGE_API_URL || 'https://free-generate-image.den-fstack.workers.dev/';
const CF_API_KEY = process.env.IMAGE_API_KEY || '';
const AGNES_API_KEY = process.env.AGNES_API_KEY || '';

const tasks = new Map();

setInterval(() => {
  const now = Date.now();
  // Remove old tasks after 10 minutes
  tasks.forEach((task, id) => {
    if (now - task.createdAt > 600000) tasks.delete(id);
  });
}, 600000);

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

async function processTask(
  taskId: string,
  prompt: string,
  model: string,
  count: number,
  payload: Record<string, unknown>,
  apiURL: string,
  apiKey: string
) {
  const task = tasks.get(taskId);
  if (!task) return;

  task.status = 'processing';
  console.log(`[${taskId}] Processing ${count} image(s)`);

  try {
    if (!apiKey) {
      throw new Error('API_KEY is not configured');
    }

    console.log(`[${taskId}] Sending to ${apiURL}`);
    console.log(`[${taskId}] Payload:`, JSON.stringify(payload));

    const promises = Array.from({ length: count }, () =>
      fetch(apiURL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    );

    const results = await Promise.allSettled(promises);
    const images = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const response = result.value;
        console.log(`[${taskId}] Response status: ${response.status}`);

        const rawText = await response.text();
        console.log(`[${taskId}] RAW RESPONSE:`, rawText.substring(0, 500));
        console.log(`[${taskId}] RAW RESPONSE length:`, rawText.length);

        if (response.ok) {
          let imageData = null;

          try {
            const json = JSON.parse(rawText);
            console.log(`[${taskId}] Parsed JSON keys:`, Object.keys(json));

            // Agnes response format: data[].url
            if (json.data && Array.isArray(json.data) && json.data.length > 0) {
              const firstItem = json.data[0];
              if (firstItem.url) {
                imageData = firstItem.url;
                console.log(`[${taskId}] Found URL: ${imageData}`);
              } else if (firstItem.b64_json) {
                imageData = `data:image/png;base64,${firstItem.b64_json}`;
                console.log(`[${taskId}] Found Base64`);
              }
            }
            
            // Cloudflare format fallback
            if (!imageData) {
              const possibleFields = ['image', 'data', 'b64_json', 'output', 'result', 'images', 'url'];
              for (const field of possibleFields) {
                if (json[field]) {
                  console.log(`[${taskId}] Found field '${field}'`);
                  
                  if (field === 'images' && Array.isArray(json[field]) && json[field].length > 0) {
                    const base64String = json[field][0];
                    if (typeof base64String === 'string') {
                      let clean = base64String;
                      if (clean.includes(';base64,')) {
                        clean = clean.split(';base64,')[1];
                      }
                      imageData = clean.startsWith('data:image') ? clean : `data:image/png;base64,${clean}`;
                      break;
                    }
                  } else if (typeof json[field] === 'string' && json[field].length > 100) {
                    const base64String = json[field];
                    let clean = base64String;
                    if (clean.includes(';base64,')) {
                      clean = clean.split(';base64,')[1];
                    }
                    imageData = clean.startsWith('data:image') ? clean : `data:image/png;base64,${clean}`;
                    break;
                  }
                }
              }
            }

            if (imageData) {
              images.push({ url: imageData, success: true });
              console.log(`[${taskId}] SUCCESS! Image data length: ${imageData.length}`);
            } else {
              console.error(`[${taskId}] No image found. Full response:`, JSON.stringify(json));
              images.push({
                url: '',
                success: false,
                error: `No image in response. Keys: ${Object.keys(json).join(', ')}`
              });
            }
          } catch (parseError) {
            console.log(`[${taskId}] Not JSON, trying as base64 string`);
            if (rawText.length > 100 && !rawText.includes('<')) {
              images.push({ url: `data:image/png;base64,${rawText.trim()}`, success: true });
            } else {
              console.error(`[${taskId}] Invalid response format:`, rawText.substring(0, 200));
              images.push({
                url: '',
                success: false,
                error: `Invalid response: ${rawText.substring(0, 100)}`
              });
            }
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
  try {
    const body = await request.json();
    const {
      prompt,
      model = 'agnes-image-2.1-flash',
      count = 1,
      size = '1K',
      ratio = '1:1',
      width = 1024,
      height = 1024,
      negative_prompt = '',
      seed = -1,
      steps = 20,
      guidance_scale = 7.5,
    } = body;

    // Determine if Agnes or Cloudflare
    const isAgnes = model === 'agnes-image-2.1-flash';
    const apiURL = isAgnes ? AGNES_API_URL : CF_API_URL;
    const apiKey = isAgnes ? AGNES_API_KEY : CF_API_KEY;

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (count < 1 || count > 4) {
      return NextResponse.json({ error: 'Count must be between 1 and 4' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({
        error: 'Server configuration error: API_KEY is not set'
      }, { status: 500 });
    }

    // Build payload based on model
    const payload: Record<string, unknown> = {};

    if (isAgnes) {
      payload.model = 'agnes-image-2.1-flash';
      payload.prompt = prompt.trim();
      payload.size = size;
      payload.ratio = ratio;
      payload.extra_body = { response_format: 'url' };
    } else {
      payload.prompt = prompt.trim();
      payload.width = Math.min(2048, Math.max(256, Math.round(width / 64) * 64));
      payload.height = Math.min(2048, Math.max(256, Math.round(height / 64) * 64));
      payload.model = model;
      
      if (negative_prompt && negative_prompt.trim()) {
        payload.negative_prompt = negative_prompt.trim();
      }
      if (seed >= 0) {
        payload.seed = seed;
      }
      if (steps > 0) {
        payload.steps = steps;
      }
      if (guidance_scale > 0) {
        payload.guidance_scale = guidance_scale;
      }
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

    if (isAgnes) {
      console.log(`[${taskId}] Agnes payload:`, JSON.stringify(payload));
    }

    // Fire and forget - task continues in background
    processTask(taskId, prompt.trim(), model, count, payload, apiURL, apiKey);

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

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Model {
  id: string;
  name: string;
  description: string;
  speed: string;
  quality: string;
}

interface GeneratedImage {
  url: string;
  prompt: string;
  model: string;
  loading: boolean;
  error: string | null;
}

// ⚠️ УДАЛИ ЭТО ОТСЮДА! API_KEY ДОЛЖЕН БЫТЬ ТОЛЬКО НА БЕКЕНДЕ!
// const API_URL = 'https://free-generate-image.den-fstack.workers.dev/';
// const API_KEY = 'sk-a7e45c01313481522cf4dffe2c131980';

const AVAILABLE_MODELS: Model[] = [
  { id: '@cf/stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL Base 1.0', description: 'Stable Diffusion XL — высокое качество', speed: 'Medium', quality: 'High' },
  { id: '@cf/black-forest-labs/flux-1-schnell', name: 'FLUX.1 Schnell', description: 'FLUX — быстрая генерация', speed: 'Fast', quality: 'High' },
  { id: '@cf/bytedance/stable-diffusion-xl-lightning', name: 'SDXL Lightning', description: 'Молниеносная генерация', speed: 'Very Fast', quality: 'Medium' },
  { id: '@cf/lykon/dreamshaper-8-lcm', name: 'DreamShaper 8', description: 'Художественный стиль', speed: 'Fast', quality: 'Medium' },
];

interface TaskResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'done' | 'error';
}

interface TaskStatusResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  images: Array<{
    url: string;
    success: boolean;
    error?: string;
  }>;
  prompt: string;
  model: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(AVAILABLE_MODELS[1].id);
  const [count, setCount] = useState(1);
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Отладка - смотрим состояние prompt
  useEffect(() => {
    console.log('Prompt changed:', prompt);
    console.log('Prompt trimmed:', prompt.trim());
    console.log('Is empty:', !prompt.trim());
  }, [prompt]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const pollTaskStatus = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/generate?taskId=${id}`);
      if (!response.ok) {
        throw new Error(`Failed to get task status: ${response.status}`);
      }

      const data: TaskStatusResponse = await response.json();
      console.log('Task status:', data.status);

      if (data.status === 'done' || data.status === 'error') {
        clearInterval(pollIntervalRef.current!);
        pollIntervalRef.current = null;

        setGlobalLoading(false);
        setTaskStatus(null);
        setTaskId(null);

        const newImages: GeneratedImage[] = data.images.map((img) => ({
          url: img.success ? img.url : '',
          prompt: data.prompt,
          model: data.model,
          loading: false,
          error: img.success ? null : (img.error || 'Unknown error'),
        }));

        setImages(newImages);

        const successCount = newImages.filter(i => !i.error).length;
        if (successCount === 0) {
          setGlobalError('All generations failed');
        }
      } else if (data.status === 'processing') {
        setTaskStatus('processing...');
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, []);

  const generate = useCallback(async () => {
    console.log('Generate called!');
    console.log('Prompt value:', prompt);
    console.log('Prompt trimmed:', prompt.trim());

    if (!prompt.trim()) {
      console.log('Prompt is empty, returning');
      setGlobalError('Please enter a prompt');
      return;
    }

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    setGlobalLoading(true);
    setGlobalError(null);
    setTaskStatus('submitting...');
    setTaskId(null);

    const initialImages: GeneratedImage[] = Array.from({ length: count }, () => ({
      url: '',
      prompt: prompt.trim(),
      model,
      loading: true,
      error: null,
    }));
    setImages(initialImages);

    try {
      console.log('Sending request to /api/generate');

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model,
          count,
          width,
          height,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data: TaskResponse = await response.json();
      console.log('Task created:', data.taskId);

      setTaskId(data.taskId);
      setTaskStatus('processing...');

      pollIntervalRef.current = setInterval(() => {
        pollTaskStatus(data.taskId);
      }, 2000);

      setTimeout(() => pollTaskStatus(data.taskId), 500);

    } catch (err) {
      console.error('Generation error:', err);
      setGlobalError(err instanceof Error ? err.message : 'Unknown error');
      setGlobalLoading(false);
      setTaskStatus(null);
      setImages([]);
    }
  }, [prompt, model, count, width, height, pollTaskStatus]);

  const regenerate = useCallback(() => {
    generate();
  }, [generate]);

  const cancel = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setGlobalLoading(false);
    setTaskStatus(null);
    setTaskId(null);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generate();
    }
  };

  const successCount = images.filter(i => !i.loading && !i.error).length;
  const errorCount = images.filter(i => i.error).length;

  // Отладка перед рендером
  console.log('RENDER - Prompt:', prompt);
  console.log('RENDER - Is disabled:', !prompt.trim());

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold gradient-text">AI Image Generator</h1>
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--green)] animate-pulse"></span>
            Powered by Cloudflare Workers AI
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        <div className="glass rounded-2xl p-6 mb-8 animate-fadeInUp">
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
              Describe your image
            </label>
            <textarea
              value={prompt}
              onChange={e => {
                console.log('Textarea onChange:', e.target.value);
                setPrompt(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder="A futuristic city at sunset, flying cars, neon lights, cyberpunk style..."
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--purple)] resize-none transition-colors"
              rows={3}
            />
            {/* Отладка - показываем состояние */}
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              Current: "{prompt}" | Length: {prompt.length} | Trimmed: "{prompt.trim()}" | Empty: {!prompt.trim() ? 'YES' : 'NO'}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                Model
              </label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text)] focus:outline-none focus:border-[var(--purple)] transition-colors cursor-pointer"
              >
                {AVAILABLE_MODELS.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[140px]">
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                Count
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`w-12 h-12 rounded-xl font-bold text-lg transition-all ${
                      count === n
                        ? 'bg-[var(--gradient)] text-white shadow-lg shadow-purple-500/30'
                        : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--purple)]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-w-[160px]">
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                Size
              </label>
              <select
                value={width + 'x' + height}
                onChange={e => {
                  const parts = e.target.value.split('x');
                  setWidth(parseInt(parts[0]));
                  setHeight(parseInt(parts[1]));
                }}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text)] focus:outline-none focus:border-[var(--purple)] transition-colors cursor-pointer"
              >
                <option value="512x512">512 x 512</option>
                <option value="768x768">768 x 768</option>
                <option value="1024x1024">1024 x 1024</option>
                <option value="1024x768">1024 x 768</option>
                <option value="768x1024">768 x 1024</option>
                <option value="1280x720">1280 x 720</option>
                <option value="720x1280">720 x 1280</option>
              </select>
            </div>

            {globalLoading ? (
              <button
                onClick={cancel}
                className="px-8 py-3 bg-red-500/80 text-white font-semibold rounded-xl hover:bg-red-500 transition-all shadow-lg min-w-[160px]"
              >
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Cancel
                </span>
              </button>
            ) : (
              <button
                onClick={generate}
                disabled={!prompt.trim()}
                className={`px-8 py-3 font-semibold rounded-xl transition-all min-w-[160px] ${
                  !prompt.trim()
                    ? 'bg-gray-600/30 text-gray-400 cursor-not-allowed'
                    : 'bg-[var(--gradient)] text-white hover:opacity-90 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40'
                }`}
              >
                ✨ Generate
              </button>
            )}
          </div>

          {taskStatus && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400 text-sm flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
              {taskStatus} {taskId && `(Task: ${taskId})`}
            </div>
          )}

          {globalError && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              ⚠️ {globalError}
            </div>
          )}
        </div>

        {images.length > 0 && (
          <div className="animate-fadeInUp">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  {globalLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-[var(--purple)] border-t-transparent rounded-full animate-spin"></span>
                      Generating {count} image{count !== 1 ? 's' : ''}...
                    </span>
                  ) : (
                    <>
                      {successCount > 0 && `${successCount} image${successCount !== 1 ? 's' : ''} generated`}
                      {errorCount > 0 && `, ${errorCount} failed`}
                    </>
                  )}
                </h2>
                {images[0]?.prompt && (
                  <p className="text-sm text-[var(--text-muted)]">
                    &ldquo;{images[0].prompt}&rdquo; — {AVAILABLE_MODELS.find(m => m.id === model)?.name}
                  </p>
                )}
              </div>
              {!globalLoading && successCount > 0 && (
                <button
                  onClick={regenerate}
                  className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-[var(--text)] hover:border-[var(--purple)] transition-colors text-sm flex items-center gap-2"
                >
                  🔄 Regenerate
                </button>
              )}
            </div>

            <div className={`grid gap-4 ${
              images.length === 1 ? 'grid-cols-1 max-w-2xl' :
              images.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
              images.length === 3 ? 'grid-cols-1 md:grid-cols-3' :
              'grid-cols-1 md:grid-cols-2'
            }`}>
              {images.map((img, idx) => (
                <div key={idx} className="glass rounded-2xl overflow-hidden group">
                  {img.loading ? (
                    <div className="aspect-square flex flex-col items-center justify-center p-8">
                      <div className="w-12 h-12 border-3 border-[var(--purple)] border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-[var(--text-muted)] text-sm">Generating image {idx + 1}...</p>
                    </div>
                  ) : img.error ? (
                    <div className="aspect-square flex flex-col items-center justify-center p-8 text-center">
                      <p className="text-4xl mb-2">😵</p>
                      <p className="text-red-400 text-sm">{img.error}</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={img.url}
                        alt={`Generated ${idx + 1}`}
                        className="w-full h-auto object-cover"
                        onError={(e) => {
                          console.error('Image failed to load:', img.url);
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <a
                          href={img.url}
                          download={`generated-${idx + 1}.png`}
                          className="px-4 py-2 bg-[var(--gradient)] text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                        >
                          ⬇️ Download
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {images.length === 0 && !globalLoading && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎨</div>
            <h2 className="text-2xl font-bold text-[var(--text)] mb-2">
              Create stunning images with AI
            </h2>
            <p className="text-[var(--text-muted)] max-w-md mx-auto">
              Describe what you want to see, choose a model, and generate beautiful images in seconds.
            </p>
          </div>
        )}
      </main>

      <footer className="glass px-6 py-4 text-center text-sm text-[var(--text-muted)]">
        AI Image Generator — Powered by Cloudflare Workers AI
      </footer>
    </div>
  );
}
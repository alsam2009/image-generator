'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

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

const API_URL = 'https://free-generate-image.den-fstack.workers.dev/';
const API_KEY = 'sk-a7e45c01313481522cf4dffe2c131980';

const AVAILABLE_MODELS: Model[] = [
  { id: '@cf/stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL Base 1.0', description: 'Stable Diffusion XL — высокое качество', speed: 'Medium', quality: 'High' },
  { id: '@cf/black-forest-labs/flux-1-schnell', name: 'FLUX.1 Schnell', description: 'FLUX — быстрая генерация', speed: 'Fast', quality: 'High' },
  { id: '@cf/bytedance/stable-diffusion-xl-lightning', name: 'SDXL Lightning', description: 'Молниеносная генерация', speed: 'Very Fast', quality: 'Medium' },
  { id: '@cf/lykon/dreamshaper-8-lcm', name: 'DreamShaper 8', description: 'Художественный стиль', speed: 'Fast', quality: 'Medium' },
];

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
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const generate = useCallback(async () => {
    if (!prompt.trim()) {
      setGlobalError('Please enter a prompt');
      return;
    }

    // Cancel any in-flight requests
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setGlobalLoading(true);
    setGlobalError(null);
    setTaskStatus('generating...');

    // Initialize loading state
    const initialImages: GeneratedImage[] = Array.from({ length: count }, () => ({
      url: '',
      prompt: prompt.trim(),
      model,
      loading: true,
      error: null,
    }));
    setImages(initialImages);

    try {
      console.log('Frontend: generating', count, 'image(s) directly via', API_URL);

      // Fire all requests in parallel directly from browser
      const promises = Array.from({ length: count }, () =>
        fetch(API_URL, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: prompt.trim(), model, width, height }),
          signal: abortRef.current!.signal,
        }).then(async (res) => {
          if (!res.ok) {
            const text = await res.text();
            throw new Error('API ' + res.status + ': ' + text);
          }
          const blob = await res.blob();
          return URL.createObjectURL(blob);
        })
      );

      const results = await Promise.allSettled(promises);

      const newImages: GeneratedImage[] = results.map((result) => {
        if (result.status === 'fulfilled') {
          return {
            url: result.value,
            prompt: prompt.trim(),
            model,
            loading: false,
            error: null,
          };
        } else {
          return {
            url: '',
            prompt: prompt.trim(),
            model,
            loading: false,
            error: result.reason?.message || 'Failed',
          };
        }
      });

      setImages(newImages);
      setGlobalLoading(false);
      setTaskStatus(null);

      const successCount = newImages.filter(i => !i.error).length;
      if (successCount === 0) {
        setGlobalError('All generations failed');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }
      setGlobalError(err instanceof Error ? err.message : 'Unknown error');
      setGlobalLoading(false);
      setTaskStatus(null);
      setImages([]);
    }
  }, [prompt, model, count, width, height]);

  const regenerate = useCallback(() => {
    generate();
  }, [generate]);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setGlobalLoading(false);
    setTaskStatus(null);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generate();
    }
  };

  const successCount = images.filter(i => !i.loading && !i.error).length;
  const errorCount = images.filter(i => i.error).length;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold gradient-text">AI Image Generator</h1>
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--green)] animate-pulse"></span>
            Powered by Cloudflare Workers AI
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {/* Input Section */}
        <div className="glass rounded-2xl p-6 mb-8 animate-fadeInUp">
          {/* Prompt */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
              Describe your image
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="A futuristic city at sunset, flying cars, neon lights, cyberpunk style..."
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--purple)] resize-none transition-colors"
              rows={3}
            />
          </div>

          {/* Controls Row */}
          <div className="flex flex-wrap gap-4 items-end">
            {/* Model Selector */}
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

            {/* Count Selector */}
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

            {/* Size Selector */}
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

            {/* Generate Button */}
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
                className="px-8 py-3 bg-[var(--gradient)] text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 min-w-[160px]"
              >
                ✨ Generate
              </button>
            )}
          </div>

          {/* Error */}
          {globalError && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              ⚠️ {globalError}
            </div>
          )}
        </div>

        {/* Results */}
        {images.length > 0 && (
          <div className="animate-fadeInUp">
            {/* Result Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  {globalLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-[var(--purple)] border-t-transparent rounded-full animate-spin"></span>
                      Generating {count} image{count !== 1 ? 's' : ''}... {taskStatus}
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
              {!globalLoading && (
                <button
                  onClick={regenerate}
                  className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-[var(--text)] hover:border-[var(--purple)] transition-colors text-sm flex items-center gap-2"
                >
                  🔄 Regenerate
                </button>
              )}
            </div>

            {/* Image Grid */}
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

        {/* Empty State */}
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

      {/* Footer */}
      <footer className="glass px-6 py-4 text-center text-sm text-[var(--text-muted)]">
        AI Image Generator — Powered by Cloudflare Workers AI
      </footer>
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';

interface Model {
  id: string;
  name: string;
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

const AVAILABLE_MODELS: Model[] = [
  { id: '@cf/stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL Base 1.0', speed: 'Medium', quality: 'High' },
  { id: '@cf/black-forest-labs/flux-1-schnell', name: 'FLUX.1 Schnell', speed: 'Fast', quality: 'High' },
  { id: '@cf/bytedance/stable-diffusion-xl-lightning', name: 'SDXL Lightning', speed: 'Very Fast', quality: 'Medium' },
  { id: '@cf/lykon/dreamshaper-8-lcm', name: 'DreamShaper 8', speed: 'Fast', quality: 'Medium' },
];

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(AVAILABLE_MODELS[1].id);
  const [count, setCount] = useState(1);
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const generate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);
    setElapsed(0);

    const initialImages: GeneratedImage[] = Array.from({ length: count }, () => ({
      url: '',
      prompt: prompt.trim(),
      model: model + ' (' + width + 'x' + height + ')',
      loading: true,
      error: null,
    }));
    setImages(initialImages);

    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      console.log('POST /api/generate');
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), model, count, width, height }),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response:', JSON.stringify(data).substring(0, 300));

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      const newImages: GeneratedImage[] = data.images.map((img: { url: string; success: boolean; error?: string }) => ({
        url: img.url,
        prompt: prompt.trim(),
        model,
        loading: false,
        error: img.success ? null : (img.error || 'Failed'),
      }));

      setImages(newImages);

      const successCount = newImages.filter(i => !i.error).length;
      if (successCount === 0) {
        setError('All generations failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setImages([]);
    } finally {
      clearInterval(timer);
      setLoading(false);
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }
  }, [prompt, model, count]);

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
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="A futuristic city at sunset, flying cars, neon lights, cyberpunk style..."
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--purple)] resize-none transition-colors"
              rows={3}
            />
          </div>

          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Model</label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text)] focus:outline-none focus:border-[var(--purple)] transition-colors cursor-pointer"
              >
                {AVAILABLE_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="min-w-[140px]">
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Count</label>
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
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Size</label>
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

            <button
              onClick={generate}
              disabled={loading || !prompt.trim()}
              className="px-8 py-3 bg-[var(--gradient)] text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 min-w-[160px]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  {elapsed}s...
                </span>
              ) : (
                '✨ Generate'
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              ⚠️ {error}
            </div>
          )}
        </div>

        {images.length > 0 && (
          <div className="animate-fadeInUp">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-[var(--purple)] border-t-transparent rounded-full animate-spin"></span>
                      Generating... {elapsed}s
                    </span>
                  ) : (
                    <>
                      {successCount > 0 && `${successCount} image${successCount !== 1 ? 's' : ''} generated`}
                      {errorCount > 0 && `, ${errorCount} failed`}
                      {elapsed > 0 && ` in ${elapsed}s`}
                    </>
                  )}
                </h2>
                {images[0]?.prompt && (
                  <p className="text-sm text-[var(--text-muted)]">
                    &ldquo;{images[0].prompt}&rdquo; — {AVAILABLE_MODELS.find(m => m.id === model)?.name}
                  </p>
                )}
              </div>
              {!loading && successCount > 0 && (
                <button
                  onClick={generate}
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
                      <img src={img.url} alt={`Generated ${idx + 1}`} className="w-full h-auto object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <a href={img.url} download={`generated-${idx + 1}.png`} className="px-4 py-2 bg-[var(--gradient)] text-white rounded-xl font-medium hover:opacity-90 transition-opacity">
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

        {images.length === 0 && !loading && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎨</div>
            <h2 className="text-2xl font-bold text-[var(--text)] mb-2">Create stunning images with AI</h2>
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

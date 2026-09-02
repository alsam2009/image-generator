'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Model {
  id: string;
  name: string;
  description: string;
  speed: string;
  quality: string;
  hasAdvanced: boolean;
  useSizeTier: boolean;
}

interface ModelAdvancedConfig {
  negativePromptPlaceholder: string;
  negativePromptHint: string;
  stepsMin: number;
  stepsMax: number;
  stepsDefault: number;
  stepsLabel: string;
  stepsHint: string;
  guidanceMin: number;
  guidanceMax: number;
  guidanceDefault: number;
  guidanceLabel: string;
  guidanceHint: string;
  hasGuidance: boolean;
  hasSeed: boolean;
}

interface GeneratedImage {
  url: string;
  prompt: string;
  model: string;
  loading: boolean;
  error: string | null;
}

const AVAILABLE_MODELS: Model[] = [
  { id: 'agnes-image-2.1-flash', name: 'Agnes Image 2.1 Flash', description: 'Высокое качество, сложные композиции', speed: 'Fast', quality: 'High', hasAdvanced: false, useSizeTier: true },
  { id: '@cf/stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL Base 1.0', description: 'Stable Diffusion XL — высокое качество', speed: 'Medium', quality: 'High', hasAdvanced: true, useSizeTier: false },
  { id: '@cf/bytedance/stable-diffusion-xl-lightning', name: 'SDXL Lightning', description: 'Молниеносная генерация', speed: 'Very Fast', quality: 'Medium', hasAdvanced: true, useSizeTier: false },
  { id: '@cf/lykon/dreamshaper-8-lcm', name: 'DreamShaper 8', description: 'Художественный стиль', speed: 'Fast', quality: 'Medium', hasAdvanced: true, useSizeTier: false },
];

const ADVANCED_CONFIG: Record<string, ModelAdvancedConfig> = {
  '@cf/stabilityai/stable-diffusion-xl-base-1.0': {
    negativePromptPlaceholder: 'blurry, low quality, ugly...',
    negativePromptHint: 'чего избегать',
    stepsMin: 1,
    stepsMax: 20,
    stepsDefault: 20,
    stepsLabel: 'Steps',
    stepsHint: 'качество',
    guidanceMin: 1,
    guidanceMax: 15,
    guidanceDefault: 7.5,
    guidanceLabel: 'Guidance',
    guidanceHint: 'следование промпту',
    hasGuidance: true,
    hasSeed: true,
  },
  '@cf/bytedance/stable-diffusion-xl-lightning': {
    negativePromptPlaceholder: 'blurry, low quality, ugly...',
    negativePromptHint: 'чего избегать',
    stepsMin: 1,
    stepsMax: 8,
    stepsDefault: 4,
    stepsLabel: 'Steps',
    stepsHint: 'качество',
    guidanceMin: 1,
    guidanceMax: 15,
    guidanceDefault: 7.5,
    guidanceLabel: 'Guidance',
    guidanceHint: 'следование промпту',
    hasGuidance: true,
    hasSeed: true,
  },
  '@cf/lykon/dreamshaper-8-lcm': {
    negativePromptPlaceholder: 'blurry, low quality, distorted...',
    negativePromptHint: 'чего избегать',
    stepsMin: 1,
    stepsMax: 20,
    stepsDefault: 20,
    stepsLabel: 'Steps',
    stepsHint: 'качество',
    guidanceMin: 1,
    guidanceMax: 15,
    guidanceDefault: 7.5,
    guidanceLabel: 'Guidance',
    guidanceHint: 'следование промпту',
    hasGuidance: true,
    hasSeed: true,
  },
};

// Agnes size dimensions
const AGNES_SIZES: Record<string, Record<string, string>> = {
  '1K': {
    '1:1': '1024×1024',
    '3:4': '864×1152',
    '4:3': '1152×864',
    '16:9': '1312×736',
    '9:16': '736×1312',
    '2:3': '832×1248',
    '3:2': '1248×832',
    '21:9': '1568×672',
  },
  '2K': {
    '1:1': '2048×2048',
    '3:4': '1728×2304',
    '4:3': '2304×1728',
    '16:9': '2624×1472',
    '9:16': '1472×2624',
    '2:3': '1664×2496',
    '3:2': '2496×1664',
    '21:9': '3136×1344',
  },
  '3K': {
    '1:1': '3072×3072',
    '3:4': '2592×3456',
    '4:3': '3456×2592',
    '16:9': '3936×2208',
    '9:16': '2208×3936',
    '2:3': '2496×3744',
    '3:2': '3744×2496',
    '21:9': '4704×2016',
  },
  '4K': {
    '1:1': '4096×4096',
    '3:4': '3456×4608',
    '4:3': '4608×3456',
    '16:9': '5248×2944',
    '9:16': '2944×5248',
    '2:3': '3328×4992',
    '3:2': '4992×3328',
    '21:9': '6272×2688',
  },
};

// Cloudflare size options
const CLOUDFLARE_SIZES = [
  { w: 512, h: 512, label: '512 × 512' },
  { w: 768, h: 768, label: '768 × 768' },
  { w: 1024, h: 1024, label: '1024 × 1024' },
  { w: 1024, h: 768, label: '1024 × 768' },
  { w: 768, h: 1024, label: '768 × 1024' },
  { w: 1280, h: 720, label: '1280 × 720 (HD)' },
  { w: 1920, h: 1080, label: '1920 × 1080 (Full HD)' },
  { w: 2048, h: 1152, label: '2048 × 1152 (2K)' },
  { w: 2048, h: 2048, label: '2048 × 2048 (Max)' },
];

interface TaskResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'done' | 'error';
}

interface TaskStatusResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  images: Array<{ url: string; success: boolean; error?: string }>;
  prompt: string;
  model: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('agnes-image-2.1-flash');
  const [count, setCount] = useState(1);
  
  // Agnes size options
  const [sizeTier, setSizeTier] = useState('1K');
  const [ratio, setRatio] = useState('1:1');
  
  // Cloudflare size options
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced settings state (only for Cloudflare models)
  const [negativePrompt, setNegativePrompt] = useState('');
  const [seed, setSeed] = useState<number | 'random'>('random');
  const [steps, setSteps] = useState(20);
  const [guidance, setGuidance] = useState(7.5);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentModel = AVAILABLE_MODELS.find(m => m.id === model)!;

  // Reset advanced settings when model changes
  useEffect(() => {
    if (currentModel.hasAdvanced) {
      const config = ADVANCED_CONFIG[model] || ADVANCED_CONFIG[Object.keys(ADVANCED_CONFIG)[0]];
      setNegativePrompt('');
      setSeed('random');
      setSteps(config.stepsDefault);
      setGuidance(config.guidanceDefault);
    }
  }, [model]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const getRandomSeed = () => Math.floor(Math.random() * 2147483647);

  const pollTaskStatus = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/generate?taskId=${id}`);

      // Stop polling on 404 or any error
      if (!response.ok) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setGlobalLoading(false);
        setGlobalError('Генератор занят. Попробуйте позже.');
        return;
      }

      const data: TaskStatusResponse = await response.json();

      if (data.status === 'done' || data.status === 'error') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setGlobalLoading(false);

        const newImages: GeneratedImage[] = data.images.map((img) => ({
          url: img.success ? img.url : '',
          prompt: data.prompt,
          model: data.model,
          loading: false,
          error: img.success ? null : (img.error || 'Unknown error'),
        }));

        setImages(newImages);
        const successCount = newImages.filter(i => !i.error).length;
        if (successCount === 0) setGlobalError('All generations failed');
      }
    } catch (error) {
      console.error('Polling error:', error);
      // Stop on error
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setGlobalLoading(false);
      setGlobalError('Generation failed. Please try again.');
    }
  }, []);

  const generate = useCallback(async () => {
    if (!prompt.trim()) {
      setGlobalError('Please enter a prompt');
      return;
    }

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    setGlobalLoading(true);
    setGlobalError(null);

    const initialImages: GeneratedImage[] = Array.from({ length: count }, () => ({
      url: '',
      prompt: prompt.trim(),
      model,
      loading: true,
      error: null,
    }));
    setImages(initialImages);

    let payload: Record<string, unknown>;
    
    if (currentModel.useSizeTier) {
      // Agnes API format
      payload = {
        prompt: prompt.trim(),
        model,
        size: sizeTier,
        ratio,
        count,
      };
    } else {
      // Cloudflare API format
      payload = {
        prompt: prompt.trim(),
        model,
        width,
        height,
        count,
        negative_prompt: negativePrompt,
        seed: seed === 'random' ? -1 : seed,
        steps,
        guidance_scale: guidance,
      };
    }

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data: TaskResponse = await response.json();

      pollIntervalRef.current = setInterval(() => pollTaskStatus(data.taskId), 2000);
      setTimeout(() => pollTaskStatus(data.taskId), 500);
      
      // Auto-stop after 2 minutes to prevent hanging
      setTimeout(() => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setGlobalLoading(false);
          setGlobalError('Generation timed out. Please try again.');
        }
      }, 120000);
    } catch (err) {
      console.error('Generation error:', err);
      setGlobalError(err instanceof Error ? err.message : 'Unknown error');
      setGlobalLoading(false);
      setImages([]);
    }
  }, [prompt, model, count, sizeTier, ratio, width, height, negativePrompt, seed, steps, guidance, currentModel, pollTaskStatus]);

  const regenerate = useCallback(() => { generate(); }, [generate]);

  const cancel = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setGlobalLoading(false);
  }, []);

  const successCount = images.filter(i => !i.loading && !i.error).length;
  const errorCount = images.filter(i => i.error).length;
  const config = currentModel.hasAdvanced ? (ADVANCED_CONFIG[model] || null) : null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generate();
    }
  };

  const downloadImage = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `generated-${index + 1}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--green)] animate-pulse"></span>
            Powered by {currentModel.useSizeTier ? 'Agnes AI' : 'Cloudflare Workers AI'}
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
            <div className="flex-1 min-w-[180px]">
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

            {currentModel.useSizeTier ? (
              <>
                <div className="min-w-[80px]">
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Size</label>
                  <select
                    value={sizeTier}
                    onChange={e => setSizeTier(e.target.value)}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text)] focus:outline-none focus:border-[var(--purple)] transition-colors cursor-pointer"
                  >
                    {['1K', '2K', '3K', '4K'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="min-w-[80px]">
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Ratio</label>
                  <select
                    value={ratio}
                    onChange={e => setRatio(e.target.value)}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text)] focus:outline-none focus:border-[var(--purple)] transition-colors cursor-pointer"
                  >
                    {[
                      { label: '1:1', value: '1:1' },
                      { label: '3:4', value: '3:4' },
                      { label: '4:3', value: '4:3' },
                      { label: '16:9', value: '16:9' },
                      { label: '9:16', value: '9:16' },
                      { label: '2:3', value: '2:3' },
                      { label: '3:2', value: '3:2' },
                      { label: '21:9', value: '21:9' },
                    ].map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div className="min-w-[100px]">
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Dimensions</label>
                  <div className="px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] text-sm font-mono">
                    {AGNES_SIZES[sizeTier]?.[ratio] || `${sizeTier} ${ratio}`}
                  </div>
                </div>
              </>
            ) : (
              <div className="min-w-[180px]">
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Size</label>
                <select
                  value={`${width}x${height}`}
                  onChange={e => {
                    const parts = e.target.value.split('x');
                    setWidth(parseInt(parts[0]));
                    setHeight(parseInt(parts[1]));
                  }}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text)] focus:outline-none focus:border-[var(--purple)] transition-colors cursor-pointer"
                >
                  {CLOUDFLARE_SIZES.map(s => (
                    <option key={`${s.w}x${s.h}`} value={`${s.w}x${s.h}`}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              {currentModel.hasAdvanced && (
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text-muted)] hover:border-[var(--purple)] transition-colors text-sm flex items-center gap-2"
                >
                  <span>▼</span>
                  {showAdvanced ? 'Hide' : 'Advanced'}
                </button>
              )}

              {globalLoading ? (
                <button
                  onClick={cancel}
                  className="px-6 py-3 bg-red-500/80 text-white font-semibold rounded-xl hover:bg-red-500 transition-all"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Cancel
                  </span>
                </button>
              ) : (
                <button
                  onClick={generate}
                  disabled={!prompt.trim()}
                  className={`px-6 py-3 font-semibold rounded-xl transition-all ${
                    !prompt.trim()
                      ? 'bg-gray-600/30 text-gray-400 cursor-not-allowed'
                      : 'bg-[var(--gradient)] text-white hover:opacity-90 shadow-lg shadow-purple-500/20'
                  }`}
                >
                  ✨ Generate
                </button>
              )}
            </div>
          </div>

          {currentModel.hasAdvanced && showAdvanced && (
            <div className="mt-4 p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border)]">
              <div className="grid grid-cols-2 gap-6">
                {/* Left column - Negative Prompt & Seed */}
                <div className="space-y-4">
                  {/* Negative Prompt */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                      Negative Prompt — {config?.negativePromptHint || ''}
                    </label>
                    <input
                      type="text"
                      value={negativePrompt}
                      onChange={e => setNegativePrompt(e.target.value)}
                      placeholder={config?.negativePromptPlaceholder || ''}
                      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--purple)] transition-colors"
                    />
                  </div>

                  {/* Seed */}
                  {config?.hasSeed && (
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                        Seed — воспроизводимость
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={seed === 'random' ? '' : seed}
                          onChange={e => setSeed(e.target.value ? parseInt(e.target.value) : 'random')}
                          placeholder="Random"
                          className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--purple)] transition-colors"
                        />
                        <button
                          onClick={() => setSeed(getRandomSeed())}
                          className="px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-muted)] hover:border-[var(--purple)] hover:text-[var(--text)] transition-colors"
                          title="Random Seed"
                        >
                          🎲 Random Seed
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right column - Steps & Guidance sliders in one row */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Steps slider */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                        <span>{config?.stepsLabel}: {steps}</span>
                        <span className="ml-1 text-xs opacity-70">— {config?.stepsHint}</span>
                      </label>
                      <input
                        type="range"
                        min={config?.stepsMin || 1}
                        max={config?.stepsMax || 20}
                        value={steps}
                        onChange={e => setSteps(parseInt(e.target.value))}
                        className="w-full h-2 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--purple)]"
                      />
                      <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
                        <span>{config?.stepsMin}</span>
                        <span>{config?.stepsMax}</span>
                      </div>
                    </div>

                    {/* Guidance slider */}
                    {config?.hasGuidance && (
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                          <span>{config?.guidanceLabel}: {guidance}</span>
                          <span className="ml-1 text-xs opacity-70">— {config?.guidanceHint}</span>
                        </label>
                        <input
                          type="range"
                          min={config?.guidanceMin || 1}
                          max={config?.guidanceMax || 15}
                          step={0.5}
                          value={guidance}
                          onChange={e => setGuidance(parseFloat(e.target.value))}
                          className="w-full h-2 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--purple)]"
                        />
                        <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
                          <span>{config?.guidanceMin}</span>
                          <span>{config?.guidanceMax}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
                    "{images[0].prompt}" — {currentModel.name}
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
        AI Image Generator — Powered by Agnes AI & Cloudflare Workers AI
      </footer>
    </div>
  );
}

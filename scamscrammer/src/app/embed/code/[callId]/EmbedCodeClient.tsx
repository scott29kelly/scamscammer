'use client';

/**
 * EmbedCodeClient Component
 *
 * Client component that displays the embed code with preview and size options.
 * Features:
 * - Size options (small, medium, large)
 * - Theme options (dark, light)
 * - Live preview of the embed
 * - Copy button for the embed code
 */

import { useState, useEffect } from 'react';

interface EmbedCodeClientProps {
  callId: string;
}

type SizeOption = 'small' | 'medium' | 'large';
type ThemeOption = 'dark' | 'light';

const SIZE_OPTIONS: Record<SizeOption, { width: number; height: number; label: string }> = {
  small: { width: 300, height: 80, label: 'Small (300x80)' },
  medium: { width: 400, height: 100, label: 'Medium (400x100)' },
  large: { width: 500, height: 120, label: 'Large (500x120)' },
};

export default function EmbedCodeClient({ callId }: EmbedCodeClientProps) {
  const [size, setSize] = useState<SizeOption>('medium');
  const [theme, setTheme] = useState<ThemeOption>('dark');
  const [copied, setCopied] = useState(false);
  const [baseUrl, setBaseUrl] = useState('https://scamscrammer.com');

  // Get the actual base URL from the current window location
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const { width, height } = SIZE_OPTIONS[size];
  const embedUrl = `${baseUrl}/embed/${callId}?theme=${theme}`;

  const embedCode = `<iframe
  src="${embedUrl}"
  width="${width}"
  height="${height}"
  frameborder="0"
  allow="autoplay"
  title="ScamScrammer Call Player"
></iframe>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <a
            href="/"
            className="text-indigo-400 hover:text-indigo-300 text-sm mb-4 inline-flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </a>
          <h1 className="text-2xl font-bold text-white mt-4">Get Embed Code</h1>
          <p className="text-gray-400 mt-2">
            Copy the code below to embed this call player on your website.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Options Panel */}
          <div className="space-y-6">
            {/* Size Options */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-medium text-white mb-4">Size</h2>
              <div className="space-y-2">
                {(Object.keys(SIZE_OPTIONS) as SizeOption[]).map((sizeKey) => (
                  <label
                    key={sizeKey}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      size === sizeKey
                        ? 'bg-indigo-600/20 border border-indigo-500'
                        : 'bg-gray-700/50 border border-transparent hover:bg-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="size"
                      value={sizeKey}
                      checked={size === sizeKey}
                      onChange={() => setSize(sizeKey)}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        size === sizeKey ? 'border-indigo-500' : 'border-gray-500'
                      }`}
                    >
                      {size === sizeKey && (
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                      )}
                    </div>
                    <span className="text-white">{SIZE_OPTIONS[sizeKey].label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Theme Options */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-medium text-white mb-4">Theme</h2>
              <div className="flex gap-3">
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex-1 p-3 rounded-lg border transition-colors ${
                    theme === 'dark'
                      ? 'bg-gray-900 border-indigo-500 text-white'
                      : 'bg-gray-700 border-transparent text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
                    </svg>
                    Dark
                  </div>
                </button>
                <button
                  onClick={() => setTheme('light')}
                  className={`flex-1 p-3 rounded-lg border transition-colors ${
                    theme === 'light'
                      ? 'bg-white border-indigo-500 text-gray-900'
                      : 'bg-gray-700 border-transparent text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z" />
                    </svg>
                    Light
                  </div>
                </button>
              </div>
            </div>

            {/* Embed Code */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-white">Embed Code</h2>
                <button
                  onClick={handleCopy}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {copied ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copy Code
                    </span>
                  )}
                </button>
              </div>
              <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm text-gray-300 font-mono">
                {embedCode}
              </pre>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-medium text-white mb-4">Preview</h2>
              <div
                className={`rounded-lg overflow-hidden ${
                  theme === 'light' ? 'bg-gray-100' : 'bg-gray-900'
                } p-4 flex items-center justify-center`}
                style={{ minHeight: height + 40 }}
              >
                <iframe
                  src={embedUrl}
                  width={width}
                  height={height}
                  frameBorder="0"
                  title="ScamScrammer Call Player Preview"
                  className="rounded-lg"
                />
              </div>
              <p className="text-sm text-gray-400 mt-4">
                This is how the player will appear when embedded on your site.
              </p>
            </div>

            {/* Usage Tips */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-medium text-white mb-4">Usage Tips</h2>
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    The embed will only work if the call is marked as public.
                    Private calls will show an error message.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    Add <code className="bg-gray-700 px-1.5 py-0.5 rounded text-indigo-300">?autoplay=true</code> to
                    the URL to enable autoplay (requires user interaction in most browsers).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    The player is fully responsive and will adapt to different container sizes.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

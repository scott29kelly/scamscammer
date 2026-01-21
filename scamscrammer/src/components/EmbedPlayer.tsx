'use client';

/**
 * EmbedPlayer Component
 *
 * A minimal, self-contained audio player designed for embedding on external sites.
 * Features: persona indicator, play/pause, progress bar, duration display, and branding.
 */

import { useRef, useState, useEffect, useCallback } from 'react';

interface PersonaInfo {
  id: string;
  name: string;
  color: string;
}

interface EmbedPlayerProps {
  recordingUrl: string;
  duration: number;
  persona?: PersonaInfo | null;
  title?: string | null;
  autoplay?: boolean;
  theme?: 'light' | 'dark';
}

// Persona color mapping
const PERSONA_COLORS: Record<string, string> = {
  earl: '#F59E0B',    // Amber
  gladys: '#8B5CF6',  // Purple
  kevin: '#10B981',   // Emerald
  brenda: '#EC4899',  // Pink
};

const PERSONA_NAMES: Record<string, string> = {
  earl: 'Earl',
  gladys: 'Gladys',
  kevin: 'Kevin',
  brenda: 'Brenda',
};

export default function EmbedPlayer({
  recordingUrl,
  duration,
  persona,
  title,
  autoplay = false,
  theme = 'dark',
}: EmbedPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Format seconds to MM:SS
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Get persona display info
  const personaColor = persona?.id ? PERSONA_COLORS[persona.id] || '#6B7280' : '#6B7280';
  const personaName = persona?.name || (persona?.id ? PERSONA_NAMES[persona.id] : null);

  // Handle play/pause toggle
  const togglePlay = useCallback(async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch {
      setError('Failed to play audio');
    }
  }, [isPlaying]);

  // Handle seek via progress bar click
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current || !audioDuration) return;

    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * audioDuration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [audioDuration]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration || duration);
      setIsLoading(false);
    };
    const handleCanPlay = () => setIsLoading(false);
    const handleError = () => {
      setError('Failed to load audio');
      setIsLoading(false);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    // Autoplay if enabled
    if (autoplay && !isLoading) {
      audio.play().catch(() => {
        // Autoplay was blocked, this is expected in many browsers
      });
    }

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [autoplay, duration, isLoading]);

  // Theme styles
  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-gray-900' : 'bg-white';
  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = isDark ? 'text-gray-400' : 'text-gray-500';
  const progressBgColor = isDark ? 'bg-gray-700' : 'bg-gray-200';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';

  // Error state
  if (error) {
    return (
      <div className={`${bgColor} ${textColor} rounded-lg p-4 flex items-center justify-center h-full border ${borderColor}`}>
        <div className="text-center">
          <svg className="mx-auto h-8 w-8 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${bgColor} rounded-lg p-3 h-full flex flex-col justify-between border ${borderColor}`}>
      {/* Hidden audio element */}
      <audio ref={audioRef} src={recordingUrl} preload="metadata" />

      {/* Top row: Persona + Title + Duration */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Persona indicator */}
          {personaName && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: personaColor }}
              />
              <span className={`text-sm font-medium ${textColor}`}>
                {personaName}
              </span>
            </div>
          )}

          {/* Title or separator */}
          {title && (
            <>
              {personaName && <span className={secondaryTextColor}>-</span>}
              <span className={`text-sm ${secondaryTextColor} truncate`}>
                {title}
              </span>
            </>
          )}
        </div>

        {/* Duration */}
        <span className={`text-xs ${secondaryTextColor} shrink-0 ml-2 font-mono`}>
          {formatTime(currentTime)} / {formatTime(audioDuration)}
        </span>
      </div>

      {/* Middle row: Play button + Progress bar */}
      <div className="flex items-center gap-3 mb-2">
        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            isLoading
              ? 'bg-gray-500 cursor-not-allowed'
              : isDark
              ? 'bg-indigo-600 hover:bg-indigo-500'
              : 'bg-indigo-500 hover:bg-indigo-600'
          }`}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : isPlaying ? (
            <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Progress bar */}
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className={`flex-1 h-2 ${progressBgColor} rounded-full cursor-pointer relative overflow-hidden`}
        >
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-100"
            style={{ width: `${audioDuration ? (currentTime / audioDuration) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Bottom row: Branding */}
      <div className="flex items-center justify-end">
        <a
          href="https://scamscrammer.com"
          target="_blank"
          rel="noopener noreferrer"
          className={`text-xs ${secondaryTextColor} hover:${textColor} transition-colors flex items-center gap-1`}
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          Powered by ScamScrammer
        </a>
      </div>
    </div>
  );
}

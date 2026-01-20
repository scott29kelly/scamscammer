'use client';

/**
 * TranscriptViewer Component
 *
 * Displays call transcript segments with speaker identification,
 * timestamps, and the ability to seek to specific segments.
 */

import { useRef, useEffect, useCallback } from 'react';

interface Segment {
  id: string;
  speaker: string;
  text: string;
  timestamp: number;
}

interface TranscriptViewerProps {
  segments: Segment[];
  currentTime?: number;
  onSeek?: (timestamp: number) => void;
}

export default function TranscriptViewer({ segments, currentTime = 0, onSeek }: TranscriptViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);

  // Format seconds to MM:SS
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Find the current active segment based on playback time
  const getActiveSegmentIndex = useCallback((): number => {
    if (segments.length === 0) return -1;

    // Find the last segment that starts before or at the current time
    for (let i = segments.length - 1; i >= 0; i--) {
      if (segments[i].timestamp <= currentTime) {
        return i;
      }
    }
    return -1;
  }, [segments, currentTime]);

  const activeIndex = getActiveSegmentIndex();

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegmentRef.current && containerRef.current) {
      const container = containerRef.current;
      const segment = activeSegmentRef.current;
      const containerRect = container.getBoundingClientRect();
      const segmentRect = segment.getBoundingClientRect();

      // Check if segment is out of view
      const isAbove = segmentRect.top < containerRect.top;
      const isBelow = segmentRect.bottom > containerRect.bottom;

      if (isAbove || isBelow) {
        segment.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeIndex]);

  // Handle segment click for seeking
  const handleSegmentClick = useCallback((timestamp: number) => {
    // First try the callback prop
    if (onSeek) {
      onSeek(timestamp);
    }
    // Also try the global seekAudio function
    const seekAudio = (window as { seekAudio?: (time: number) => void }).seekAudio;
    if (seekAudio) {
      seekAudio(timestamp);
    }
  }, [onSeek]);

  // Get speaker display info
  const getSpeakerInfo = (speaker: string) => {
    if (speaker === 'EARL') {
      return {
        name: 'Earl',
        bgColor: 'bg-indigo-900/50',
        borderColor: 'border-l-indigo-500',
        textColor: 'text-indigo-400',
        icon: '🤖',
      };
    } else {
      return {
        name: 'Scammer',
        bgColor: 'bg-red-900/30',
        borderColor: 'border-l-red-500',
        textColor: 'text-red-400',
        icon: '📞',
      };
    }
  };

  // No segments available
  if (segments.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center">
        <div className="text-gray-400">
          <svg className="mx-auto h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">No transcript available for this call</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Transcript
          <span className="text-xs text-gray-500">({segments.length} segments)</span>
        </h3>
      </div>

      {/* Segments container */}
      <div
        ref={containerRef}
        className="max-h-[500px] overflow-y-auto p-4 space-y-3"
      >
        {segments.map((segment, index) => {
          const speakerInfo = getSpeakerInfo(segment.speaker);
          const isActive = index === activeIndex;

          return (
            <div
              key={segment.id}
              ref={isActive ? activeSegmentRef : null}
              onClick={() => handleSegmentClick(segment.timestamp)}
              className={`
                p-3 rounded-lg border-l-4 cursor-pointer transition-all
                ${speakerInfo.bgColor} ${speakerInfo.borderColor}
                ${isActive ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-900' : ''}
                hover:opacity-90
              `}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleSegmentClick(segment.timestamp);
                }
              }}
              aria-label={`${speakerInfo.name} at ${formatTime(segment.timestamp)}: ${segment.text}`}
            >
              {/* Segment header */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{speakerInfo.icon}</span>
                  <span className={`text-sm font-medium ${speakerInfo.textColor}`}>
                    {speakerInfo.name}
                  </span>
                </div>
                <span className="text-xs text-gray-500 font-mono">
                  {formatTime(segment.timestamp)}
                </span>
              </div>

              {/* Segment text */}
              <p className="text-sm text-gray-200 leading-relaxed">
                {segment.text}
              </p>
            </div>
          );
        })}
      </div>

      {/* Footer with legend */}
      <div className="px-4 py-2 border-t border-gray-700 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            Earl (AI)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Scammer
          </span>
        </div>
        <span>Click a segment to jump to that time</span>
      </div>
    </div>
  );
}

'use client';

import { useRef, useEffect } from 'react';

interface Segment {
  id: string;
  speaker: string;
  text: string;
  timestamp: number;
}

interface TranscriptViewerProps {
  segments: Segment[];
  currentTime?: number;
  onSegmentClick?: (timestamp: number) => void;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function TranscriptViewer({
  segments,
  currentTime = 0,
  onSegmentClick,
}: TranscriptViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);

  // Find the current active segment based on playback time
  const activeSegmentIndex = segments.findIndex((segment, index) => {
    const nextSegment = segments[index + 1];
    return (
      currentTime >= segment.timestamp &&
      (nextSegment ? currentTime < nextSegment.timestamp : true)
    );
  });

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegmentRef.current && containerRef.current) {
      const container = containerRef.current;
      const element = activeSegmentRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      // Only scroll if element is out of view
      if (
        elementRect.top < containerRect.top ||
        elementRect.bottom > containerRect.bottom
      ) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeSegmentIndex]);

  if (segments.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400">
        No transcript available for this call
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="bg-gray-800 rounded-lg p-4 max-h-96 overflow-y-auto"
    >
      <h3 className="text-lg font-semibold text-white mb-4 sticky top-0 bg-gray-800 py-2">
        Call Transcript
      </h3>
      <div className="space-y-3">
        {segments.map((segment, index) => {
          const isEarl = segment.speaker === 'EARL';
          const isActive = index === activeSegmentIndex;

          return (
            <div
              key={segment.id}
              ref={isActive ? activeSegmentRef : null}
              onClick={() => onSegmentClick?.(segment.timestamp)}
              className={`
                flex gap-3 p-3 rounded-lg cursor-pointer transition-all
                ${isActive ? 'bg-gray-700 ring-2 ring-blue-500' : 'hover:bg-gray-700/50'}
              `}
            >
              {/* Speaker avatar */}
              <div
                className={`
                  flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                  ${isEarl ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}
                `}
              >
                {isEarl ? '👴' : '🦹'}
              </div>

              {/* Message content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`font-medium ${isEarl ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {isEarl ? 'Earl' : 'Scammer'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(segment.timestamp)}
                  </span>
                </div>
                <p className="text-gray-200 text-sm whitespace-pre-wrap break-words">
                  {segment.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

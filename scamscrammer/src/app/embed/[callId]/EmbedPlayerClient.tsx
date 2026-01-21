'use client';

/**
 * EmbedPlayerClient Component
 *
 * Client component that fetches call data and renders the EmbedPlayer.
 * Handles loading, error states, and missing/private calls gracefully.
 */

import { useState, useEffect } from 'react';
import EmbedPlayer from '@/components/EmbedPlayer';

interface EmbedPlayerClientProps {
  callId: string;
  autoplay: boolean;
  theme: 'light' | 'dark';
}

interface CallData {
  id: string;
  persona: { id: string; name: string } | null;
  duration: number;
  recordingUrl: string;
  title: string | null;
}

interface ErrorState {
  message: string;
  code: 'NOT_FOUND' | 'PRIVATE' | 'ERROR';
}

export default function EmbedPlayerClient({
  callId,
  autoplay,
  theme,
}: EmbedPlayerClientProps) {
  const [callData, setCallData] = useState<CallData | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCallData() {
      try {
        const response = await fetch(`/api/public/embed/${callId}`);

        if (!response.ok) {
          if (response.status === 404) {
            const data = await response.json();
            setError({
              message: data.error || 'Call not found',
              code: data.code === 'PRIVATE' ? 'PRIVATE' : 'NOT_FOUND',
            });
          } else {
            setError({
              message: 'Failed to load call',
              code: 'ERROR',
            });
          }
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        setCallData(data);
      } catch {
        setError({
          message: 'Failed to load call',
          code: 'ERROR',
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchCallData();
  }, [callId]);

  // Theme styles
  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-gray-900' : 'bg-gray-100';
  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-300';

  // Loading state
  if (isLoading) {
    return (
      <div className={`min-h-screen ${bgColor} flex items-center justify-center p-4`}>
        <div className={`w-full max-w-md ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${borderColor}`}>
          <div className="flex items-center justify-center gap-3">
            <svg className={`animate-spin h-6 w-6 ${secondaryTextColor}`} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className={secondaryTextColor}>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error states
  if (error) {
    return (
      <div className={`min-h-screen ${bgColor} flex items-center justify-center p-4`}>
        <div className={`w-full max-w-md ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${borderColor} text-center`}>
          {error.code === 'NOT_FOUND' && (
            <>
              <svg className={`mx-auto h-12 w-12 ${secondaryTextColor} mb-4`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className={`text-lg font-medium ${textColor} mb-2`}>Call Not Found</h2>
              <p className={`text-sm ${secondaryTextColor}`}>
                This call recording doesn&apos;t exist or has been removed.
              </p>
            </>
          )}

          {error.code === 'PRIVATE' && (
            <>
              <svg className={`mx-auto h-12 w-12 ${secondaryTextColor} mb-4`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h2 className={`text-lg font-medium ${textColor} mb-2`}>Private Call</h2>
              <p className={`text-sm ${secondaryTextColor}`}>
                This call recording is not available for public viewing.
              </p>
            </>
          )}

          {error.code === 'ERROR' && (
            <>
              <svg className="mx-auto h-12 w-12 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className={`text-lg font-medium ${textColor} mb-2`}>Error Loading Call</h2>
              <p className={`text-sm ${secondaryTextColor}`}>
                Something went wrong. Please try again later.
              </p>
            </>
          )}

          {/* Branding even in error state */}
          <div className="mt-6 pt-4 border-t border-gray-700">
            <a
              href="https://scamscrammer.com"
              target="_blank"
              rel="noopener noreferrer"
              className={`text-xs ${secondaryTextColor} hover:${textColor} transition-colors`}
            >
              Powered by ScamScrammer
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Success - render the player
  if (!callData) {
    return null;
  }

  return (
    <div className={`min-h-screen ${bgColor} flex items-center justify-center p-2`}>
      <div className="w-full max-w-lg h-[100px]">
        <EmbedPlayer
          recordingUrl={callData.recordingUrl}
          duration={callData.duration}
          persona={callData.persona ? { id: callData.persona.id, name: callData.persona.name, color: '' } : null}
          title={callData.title}
          autoplay={autoplay}
          theme={theme}
        />
      </div>
    </div>
  );
}

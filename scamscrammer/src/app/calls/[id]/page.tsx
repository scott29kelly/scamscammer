'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AudioPlayer, { useAudioPlayerControl } from '@/components/AudioPlayer';
import TranscriptViewer from '@/components/TranscriptViewer';
import CallDetails from '@/components/CallDetails';
import type { CallResponse, ApiErrorResponse } from '@/types';

export default function CallDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { seekTo } = useAudioPlayerControl();
  const id = params.id as string;

  const [call, setCall] = useState<CallResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const fetchCall = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/calls/${id}`);
      const data: CallResponse | ApiErrorResponse = await response.json();

      if (!response.ok) {
        setError((data as ApiErrorResponse).error);
        return;
      }

      setCall(data as CallResponse);
      setError(null);
    } catch {
      setError('Failed to load call details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCall();
  }, [fetchCall]);

  const handleUpdate = async (updates: { rating?: number; notes?: string; tags?: string[] }) => {
    try {
      const response = await fetch(`/api/calls/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const data: ApiErrorResponse = await response.json();
        console.error('Failed to update call:', data.error);
        return;
      }

      const updatedCall: CallResponse = await response.json();
      setCall(updatedCall);
    } catch (err) {
      console.error('Failed to update call:', err);
    }
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  const handleSegmentClick = (timestamp: number) => {
    seekTo(timestamp);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading call details...</p>
        </div>
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-2">Call Not Found</h1>
          <p className="text-gray-400 mb-6">{error || 'The requested call could not be found.'}</p>
          <button
            onClick={() => router.push('/calls')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors"
          >
            Back to Calls
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/calls')}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Back to calls"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold">Call Recording</h1>
              <p className="text-sm text-gray-400">
                {new Date(call.createdAt).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Audio player and transcript */}
          <div className="lg:col-span-2 space-y-6">
            {/* Audio Player */}
            <section>
              <h2 className="text-lg font-semibold mb-3">Recording</h2>
              <AudioPlayer
                src={call.recordingUrl}
                onTimeUpdate={handleTimeUpdate}
              />
            </section>

            {/* Transcript */}
            <section>
              <TranscriptViewer
                segments={call.segments}
                currentTime={currentTime}
                onSegmentClick={handleSegmentClick}
              />
            </section>
          </div>

          {/* Right column - Call details */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold mb-3">Call Details</h2>
            <CallDetails call={call} onUpdate={handleUpdate} />
          </div>
        </div>
      </main>
    </div>
  );
}

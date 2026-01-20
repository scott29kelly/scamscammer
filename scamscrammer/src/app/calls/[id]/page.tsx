'use client';

/**
 * Call Detail Page
 *
 * Displays a single call with audio player, transcript, and metadata.
 * Allows users to rate calls, add notes, and manage tags.
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CallPlayer from '@/components/CallPlayer';
import TranscriptViewer from '@/components/TranscriptViewer';
import type { CallResponse } from '@/types';

type CallStatus = 'RINGING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'NO_ANSWER';

export default function CallDetailPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params.id as string;

  const [call, setCall] = useState<CallResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // Edit states
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch call data
  useEffect(() => {
    const fetchCall = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/calls/${callId}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Call not found');
          }
          throw new Error('Failed to fetch call');
        }

        const data: CallResponse = await response.json();
        setCall(data);
        setRating(data.rating);
        setNotes(data.notes || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    if (callId) {
      fetchCall();
    }
  }, [callId]);

  // Handle audio time updates
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // Handle transcript seek
  const handleSeek = useCallback((timestamp: number) => {
    const seekAudio = (window as { seekAudio?: (time: number) => void }).seekAudio;
    if (seekAudio) {
      seekAudio(timestamp);
    }
  }, []);

  // Save rating and notes
  const handleSave = async () => {
    if (!call) return;

    try {
      setIsSaving(true);
      setSaveMessage(null);

      const response = await fetch(`/api/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, notes }),
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      const updatedCall = await response.json();
      setCall(updatedCall);
      setSaveMessage({ type: 'success', text: 'Changes saved!' });

      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete call
  const handleDelete = async () => {
    try {
      setIsDeleting(true);

      const response = await fetch(`/api/calls/${callId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete call');
      }

      // Navigate back to calls list
      router.push('/calls');
    } catch (err) {
      setSaveMessage({ type: 'error', text: err instanceof Error ? err.message : 'Delete failed' });
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Format date for display
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format duration
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Get status badge styling
  const getStatusBadge = (status: string) => {
    const styles: Record<CallStatus, string> = {
      COMPLETED: 'bg-green-900/50 text-green-400 border-green-700',
      IN_PROGRESS: 'bg-yellow-900/50 text-yellow-400 border-yellow-700',
      RINGING: 'bg-blue-900/50 text-blue-400 border-blue-700',
      FAILED: 'bg-red-900/50 text-red-400 border-red-700',
      NO_ANSWER: 'bg-gray-700/50 text-gray-400 border-gray-600',
    };
    return styles[status as CallStatus] || styles.NO_ANSWER;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-indigo-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-400">Loading call details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <svg className="h-16 w-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1 className="text-xl font-semibold text-white mb-2">Error</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/calls')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            Back to Calls
          </button>
        </div>
      </div>
    );
  }

  // No call found
  if (!call) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-white mb-2">Call Not Found</h1>
          <p className="text-gray-400 mb-6">The call you&apos;re looking for doesn&apos;t exist.</p>
          <button
            onClick={() => router.push('/calls')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
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
      <header className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/calls')}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Back to calls"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-semibold">Call Details</h1>
                <p className="text-sm text-gray-400 font-mono">{call.twilioSid}</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm border ${getStatusBadge(call.status)}`}>
              {call.status.replace('_', ' ')}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content - Audio player and transcript */}
          <div className="lg:col-span-2 space-y-6">
            {/* Call metadata cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide">From</p>
                <p className="text-sm font-mono mt-1">{call.fromNumber}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide">To</p>
                <p className="text-sm font-mono mt-1">{call.toNumber}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Duration</p>
                <p className="text-sm mt-1">{formatDuration(call.duration)}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Date</p>
                <p className="text-sm mt-1">{formatDate(call.createdAt)}</p>
              </div>
            </div>

            {/* Audio player */}
            <div>
              <h2 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Recording
              </h2>
              <CallPlayer
                recordingUrl={call.recordingUrl}
                duration={call.duration}
                onTimeUpdate={handleTimeUpdate}
              />
            </div>

            {/* Transcript */}
            <div>
              <TranscriptViewer
                segments={call.segments}
                currentTime={currentTime}
                onSeek={handleSeek}
              />
            </div>
          </div>

          {/* Sidebar - Rating, notes, actions */}
          <div className="space-y-6">
            {/* Rating */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Entertainment Rating</h3>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(rating === star ? null : star)}
                    className={`p-1 transition-colors ${
                      rating && rating >= star
                        ? 'text-yellow-400 hover:text-yellow-300'
                        : 'text-gray-600 hover:text-gray-400'
                    }`}
                    aria-label={`Rate ${star} stars`}
                  >
                    <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {rating ? `Rated ${rating}/5 stars` : 'Click to rate'}
              </p>
            </div>

            {/* Notes */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Notes</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this call..."
                className="w-full h-32 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Tags */}
            {call.tags && call.tags.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {call.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Changes
                </>
              )}
            </button>

            {/* Save message */}
            {saveMessage && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  saveMessage.type === 'success'
                    ? 'bg-green-900/50 text-green-400 border border-green-700'
                    : 'bg-red-900/50 text-red-400 border border-red-700'
                }`}
              >
                {saveMessage.text}
              </div>
            )}

            {/* Delete button */}
            <div className="pt-4 border-t border-gray-700">
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-2 text-red-400 hover:text-red-300 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Call
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400 text-center">
                    Are you sure? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                      className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white text-sm rounded-lg transition-colors flex items-center justify-center"
                    >
                      {isDeleting ? (
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        'Delete'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Last updated */}
            <p className="text-xs text-gray-500 text-center">
              Last updated: {formatDate(call.updatedAt)}
            </p>
          </div>
        </div>
      </main>

      {/* Delete confirmation modal overlay - for mobile */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 lg:hidden" onClick={() => setShowDeleteConfirm(false)} />
      )}
    </div>
  );
}

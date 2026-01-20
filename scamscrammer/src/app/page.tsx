'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { DashboardStats, CallListItem } from '@/types';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatPhoneNumber(phone: string): string {
  // Format +1XXXXXXXXXX to (XXX) XXX-XXXX
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const area = cleaned.slice(1, 4);
    const prefix = cleaned.slice(4, 7);
    const line = cleaned.slice(7);
    return `(${area}) ${prefix}-${line}`;
  }
  return phone;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    COMPLETED: 'bg-green-500/20 text-green-400',
    IN_PROGRESS: 'bg-blue-500/20 text-blue-400',
    RINGING: 'bg-yellow-500/20 text-yellow-400',
    FAILED: 'bg-red-500/20 text-red-400',
    NO_ANSWER: 'bg-gray-500/20 text-gray-400',
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function CallRow({ call }: { call: CallListItem }) {
  return (
    <Link
      href={`/calls/${call.id}`}
      className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </div>
        <div>
          <p className="font-medium text-white">{formatPhoneNumber(call.fromNumber)}</p>
          <p className="text-sm text-gray-400">
            {new Date(call.createdAt).toLocaleDateString()} at {new Date(call.createdAt).toLocaleTimeString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {call.duration && (
          <span className="text-sm text-gray-400">{formatDuration(call.duration)}</span>
        )}
        {call.rating && (
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <svg
                key={i}
                className={`w-4 h-4 ${i < call.rating! ? 'text-yellow-400' : 'text-gray-600'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
        )}
        <StatusBadge status={call.status} />
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/stats');
        if (!res.ok) {
          if (res.status === 401) {
            setError('unauthorized');
            return;
          }
          throw new Error('Failed to fetch stats');
        }
        const data = await res.json();
        setStats(data);
      } catch {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <span className="text-xl">🎣</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">ScamScrammer</h1>
                <p className="text-xs text-gray-400">Powered by Earl</p>
              </div>
            </div>
            <nav className="flex items-center gap-4">
              <Link
                href="/calls"
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                All Calls
              </Link>
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors"
              >
                Login
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-500/20">
          <div className="flex items-start gap-4">
            <div className="text-5xl">👴</div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Meet Earl Pemberton</h2>
              <p className="text-gray-300 max-w-2xl">
                An 81-year-old retired refrigerator repairman from Tulsa, Oklahoma. He&apos;s nearly deaf,
                delightfully scatterbrained, and has all the time in the world to chat about his parakeet
                General Patton, that time he fixed Elvis&apos;s refrigerator, and whether you&apos;ve seen his reading glasses.
              </p>
              <p className="text-orange-400 mt-2 text-sm font-medium">
                Earl keeps scammers on the line so they can&apos;t scam real victims.
              </p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
          </div>
        )}

        {/* Unauthorized State */}
        {error === 'unauthorized' && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔒</div>
            <h3 className="text-xl font-semibold text-white mb-2">Login Required</h3>
            <p className="text-gray-400 mb-6">Sign in to view dashboard statistics and call history.</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-500 rounded-lg font-medium transition-colors"
            >
              Sign In
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}

        {/* Error State */}
        {error && error !== 'unauthorized' && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-white mb-2">Something went wrong</h3>
            <p className="text-gray-400">{error}</p>
          </div>
        )}

        {/* Stats Grid */}
        {stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="p-6 bg-gray-800 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-400">Total Calls</span>
                </div>
                <p className="text-3xl font-bold text-white">{stats.totalCalls.toLocaleString()}</p>
              </div>

              <div className="p-6 bg-gray-800 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-400">Total Time Wasted</span>
                </div>
                <p className="text-3xl font-bold text-white">{formatDuration(stats.totalDuration)}</p>
              </div>

              <div className="p-6 bg-gray-800 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-400">Avg Call Duration</span>
                </div>
                <p className="text-3xl font-bold text-white">{formatDuration(stats.averageDuration)}</p>
              </div>

              <div className="p-6 bg-gray-800 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-400">Completed Calls</span>
                </div>
                <p className="text-3xl font-bold text-white">{(stats.callsByStatus['COMPLETED'] || 0).toLocaleString()}</p>
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="p-6 bg-gray-800 rounded-xl">
                <h3 className="text-lg font-semibold text-white mb-4">Calls by Status</h3>
                <div className="space-y-3">
                  {Object.entries(stats.callsByStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <StatusBadge status={status} />
                      <span className="text-gray-300 font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-gray-800 rounded-xl">
                <h3 className="text-lg font-semibold text-white mb-4">Top Rated Calls</h3>
                {stats.topRatedCalls.length > 0 ? (
                  <div className="space-y-2">
                    {stats.topRatedCalls.slice(0, 3).map((call) => (
                      <Link
                        key={call.id}
                        href={`/calls/${call.id}`}
                        className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        <span className="text-gray-300">{formatPhoneNumber(call.fromNumber)}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400">{'★'.repeat(call.rating || 0)}</span>
                          {call.duration && (
                            <span className="text-sm text-gray-500">{formatDuration(call.duration)}</span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No rated calls yet</p>
                )}
              </div>
            </div>

            {/* Longest Calls */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Longest Calls (Most Time Wasted)</h3>
                <Link href="/calls" className="text-sm text-orange-400 hover:text-orange-300">
                  View all calls →
                </Link>
              </div>
              <div className="space-y-3">
                {stats.longestCalls.length > 0 ? (
                  stats.longestCalls.map((call) => <CallRow key={call.id} call={call} />)
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No calls recorded yet. Earl is waiting for the phone to ring!</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* How It Works Section */}
        <div className="mt-12 p-6 bg-gray-800/50 rounded-xl border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">How ScamScrammer Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-orange-400 font-bold">1</span>
              </div>
              <div>
                <h4 className="font-medium text-white">Scammer Calls</h4>
                <p className="text-sm text-gray-400">A scammer dials our Twilio number thinking they&apos;ve found a victim.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-orange-400 font-bold">2</span>
              </div>
              <div>
                <h4 className="font-medium text-white">Earl Answers</h4>
                <p className="text-sm text-gray-400">Our AI persona Earl picks up and starts his confused, rambling conversation.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-orange-400 font-bold">3</span>
              </div>
              <div>
                <h4 className="font-medium text-white">Time Wasted</h4>
                <p className="text-sm text-gray-400">Every minute Earl keeps them talking is a minute they can&apos;t scam real people.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            ScamScrammer &mdash; Wasting scammers&apos; time so they can&apos;t waste yours.
          </p>
        </div>
      </footer>
    </div>
  );
}

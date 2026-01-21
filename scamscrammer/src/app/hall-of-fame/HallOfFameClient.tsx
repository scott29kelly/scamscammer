'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import HallOfFameCard, { HallOfFameCallEntry } from '@/components/HallOfFameCard';

/**
 * API Response type for Hall of Fame
 */
interface HallOfFameResponse {
  longest: HallOfFameCallEntry[];
  highestRated: HallOfFameCallEntry[];
  featured: HallOfFameCallEntry[];
  stats: {
    totalTimeWasted: number;
    totalCalls: number;
    averageDuration: number;
  };
}

/**
 * Format total time wasted in a human-readable way
 */
function formatTotalTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours.toLocaleString()} hours ${minutes} minutes`;
  }
  return `${minutes} minutes`;
}

/**
 * Format average duration
 */
function formatAverageDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

/**
 * Trophy icon component
 */
function TrophyIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M7.002 3.5c0-.276.224-.5.5-.5h9a.5.5 0 0 1 .5.5V6h3.5a.5.5 0 0 1 .5.5v1c0 2.485-1.676 4.578-3.957 5.205l-.037.01A6.5 6.5 0 0 1 12.5 17.5v2h2a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h2v-2a6.5 6.5 0 0 1-4.506-4.785l-.038-.01C4.677 12.078 3.002 9.985 3.002 7.5v-1a.5.5 0 0 1 .5-.5h3.5V3.5zm-3 4v.5c0 1.837 1.276 3.374 3.002 3.784V7h-3.002zm13 0v4.784c1.726-.41 3.002-1.947 3.002-3.784v-.5H17.002zm-9-3v6.5c0 2.485 2.016 4.5 4.5 4.5s4.5-2.015 4.5-4.5v-6.5h-9z" />
    </svg>
  );
}

/**
 * Clock icon component
 */
function ClockIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/**
 * Star icon component
 */
function StarIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

/**
 * Fire icon for featured section
 */
function FireIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 23c-4.97 0-9-4.03-9-9 0-3.53 2.04-6.58 5-8.03v2.01c-2.01 1.21-3.25 3.42-3.25 5.89 0 3.79 3.08 6.87 6.87 6.87s6.87-3.08 6.87-6.87c0-2.47-1.24-4.68-3.25-5.89V5.97c2.96 1.45 5 4.5 5 8.03 0 4.97-4.03 9-9 9zm-1-16.93V2.05c-3.22.46-5.85 2.74-6.78 5.77h2.13c.75-1.89 2.36-3.35 4.15-3.82l.5-.93zM13 2.05v4.02l.5.93c1.79.47 3.4 1.93 4.15 3.82h2.13c-.93-3.03-3.56-5.31-6.78-5.77zM12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" />
    </svg>
  );
}

/**
 * Loading skeleton for cards
 */
function CardSkeleton() {
  return (
    <div className="bg-gray-800/50 rounded-2xl p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-gray-700" />
        <div>
          <div className="h-4 w-20 bg-gray-700 rounded mb-2" />
          <div className="h-3 w-16 bg-gray-700 rounded" />
        </div>
      </div>
      <div className="h-8 w-32 bg-gray-700 rounded mb-2" />
      <div className="h-4 w-48 bg-gray-700 rounded mb-4" />
      <div className="h-16 w-full bg-gray-700 rounded" />
    </div>
  );
}

/**
 * Section header component
 */
function SectionHeader({
  title,
  subtitle,
  icon,
  iconColor,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconColor: string;
}) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <div className={`w-12 h-12 rounded-xl ${iconColor} flex items-center justify-center`}>
        {icon}
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <p className="text-gray-400">{subtitle}</p>
      </div>
    </div>
  );
}

/**
 * Stats card component
 */
function StatCard({
  value,
  label,
  icon,
  gradient,
}: {
  value: string;
  label: string;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <div className={`p-6 rounded-2xl bg-gradient-to-br ${gradient} border border-gray-700/50`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-gray-300">{label}</div>
    </div>
  );
}

/**
 * Hall of Fame Client Component
 *
 * Interactive client component that fetches and displays Hall of Fame data.
 * No authentication required - designed for viral sharing.
 */
export default function HallOfFameClient() {
  const [data, setData] = useState<HallOfFameResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/public/hall-of-fame');
        if (!response.ok) {
          throw new Error('Failed to fetch Hall of Fame data');
        }
        const result: HallOfFameResponse = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <span className="text-xl">{String.fromCodePoint(0x1F3A3)}</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">ScamScrammer</h1>
                <p className="text-xs text-gray-400">Hall of Fame</p>
              </div>
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/"
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                Home
              </Link>
              <Link
                href="/calls"
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                All Calls
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6">
            <TrophyIcon className="w-4 h-4" />
            <span>Greatest Scammer Takedowns</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Hall of Fame
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Celebrating the calls that wasted the most scammer time.
            Every minute they spend with our AI personas is a minute they can&apos;t scam real victims.
          </p>
        </div>

        {/* Stats Section */}
        {data && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <StatCard
              value={formatTotalTime(data.stats.totalTimeWasted)}
              label="Total Scammer Time Wasted"
              icon={<ClockIcon className="w-5 h-5 text-green-400" />}
              gradient="from-green-500/10 to-green-600/5"
            />
            <StatCard
              value={data.stats.totalCalls.toLocaleString()}
              label="Scam Calls Handled"
              icon={
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              }
              gradient="from-blue-500/10 to-blue-600/5"
            />
            <StatCard
              value={formatAverageDuration(data.stats.averageDuration)}
              label="Average Call Duration"
              icon={<StarIcon className="w-5 h-5 text-yellow-400" />}
              gradient="from-yellow-500/10 to-yellow-600/5"
            />
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="space-y-16">
            <div>
              <div className="h-8 w-48 bg-gray-700 rounded mb-8 animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">{String.fromCodePoint(0x26A0, 0xFE0F)}</div>
            <h3 className="text-xl font-semibold text-white mb-2">Something went wrong</h3>
            <p className="text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-500 rounded-lg font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Data Loaded State */}
        {data && !loading && (
          <>
            {/* Featured Section */}
            {data.featured.length > 0 && (
              <section className="mb-16">
                <SectionHeader
                  title="Fan Favorites"
                  subtitle="Hand-picked calls that showcase our personas at their best"
                  icon={<FireIcon className="w-6 h-6 text-orange-400" />}
                  iconColor="bg-orange-500/20"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.featured.map((call) => (
                    <HallOfFameCard
                      key={call.id}
                      call={call}
                      category="featured"
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Longest Calls Section */}
            <section className="mb-16">
              <SectionHeader
                title="Longest Calls"
                subtitle="The ultimate time-wasters - these calls kept scammers busy for ages"
                icon={<ClockIcon className="w-6 h-6 text-green-400" />}
                iconColor="bg-green-500/20"
              />
              {data.longest.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.longest.map((call, index) => (
                    <HallOfFameCard
                      key={call.id}
                      call={call}
                      rank={index + 1}
                      category="longest"
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-800/30 rounded-2xl border border-gray-700/50">
                  <div className="text-4xl mb-4">{String.fromCodePoint(0x1F4DE)}</div>
                  <p className="text-gray-400">No calls yet. The scammers haven&apos;t called!</p>
                </div>
              )}
            </section>

            {/* Highest Rated Section */}
            <section className="mb-16">
              <SectionHeader
                title="Highest Rated"
                subtitle="The most entertaining calls according to our community"
                icon={<StarIcon className="w-6 h-6 text-yellow-400" />}
                iconColor="bg-yellow-500/20"
              />
              {data.highestRated.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.highestRated.map((call, index) => (
                    <HallOfFameCard
                      key={call.id}
                      call={call}
                      rank={index + 1}
                      category="highestRated"
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-800/30 rounded-2xl border border-gray-700/50">
                  <div className="text-4xl mb-4">{String.fromCodePoint(0x2B50)}</div>
                  <p className="text-gray-400">No rated calls yet. Rate some calls to see them here!</p>
                </div>
              )}
            </section>

            {/* Meet the Personas Section */}
            <section className="mb-16">
              <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/50 p-8">
                <h2 className="text-2xl font-bold text-white mb-6 text-center">Meet Our Scammer-Wasting Personas</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Earl */}
                  <div className="text-center p-6 rounded-xl bg-orange-500/10 border border-orange-500/20">
                    <div className="text-5xl mb-3">{String.fromCodePoint(0x1F474)}</div>
                    <h3 className="text-lg font-bold text-orange-400 mb-2">Earl</h3>
                    <p className="text-sm text-gray-400">
                      81-year-old retired refrigerator repairman. Nearly deaf, delightfully confused.
                    </p>
                  </div>
                  {/* Gladys */}
                  <div className="text-center p-6 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <div className="text-5xl mb-3">{String.fromCodePoint(0x1F475)}</div>
                    <h3 className="text-lg font-bold text-purple-400 mb-2">Gladys</h3>
                    <p className="text-sm text-gray-400">
                      Suspicious retiree who questions everything and demands manager callbacks.
                    </p>
                  </div>
                  {/* Kevin */}
                  <div className="text-center p-6 rounded-xl bg-green-500/10 border border-green-500/20">
                    <div className="text-5xl mb-3">{String.fromCodePoint(0x1F468, 0x200D, 0x1F4BB)}</div>
                    <h3 className="text-lg font-bold text-green-400 mb-2">Kevin</h3>
                    <p className="text-sm text-gray-400">
                      Tech-confused millennial who thinks every scammer is his friend Derek.
                    </p>
                  </div>
                  {/* Brenda */}
                  <div className="text-center p-6 rounded-xl bg-pink-500/10 border border-pink-500/20">
                    <div className="text-5xl mb-3">{String.fromCodePoint(0x1F469, 0x200D, 0x1F4BC)}</div>
                    <h3 className="text-lg font-bold text-pink-400 mb-2">Brenda</h3>
                    <p className="text-sm text-gray-400">
                      Overly enthusiastic MLM seller who turns every call into a sales pitch.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Call to Action */}
            <section className="text-center">
              <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 rounded-2xl border border-orange-500/20 p-12">
                <h2 className="text-3xl font-bold text-white mb-4">
                  Help Us Waste More Scammer Time!
                </h2>
                <p className="text-gray-300 max-w-2xl mx-auto mb-8">
                  Every minute a scammer spends talking to our AI is a minute they can&apos;t spend scamming
                  real victims. Forward suspicious calls to our service and watch the magic happen.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Link
                    href="/"
                    className="px-8 py-3 bg-orange-600 hover:bg-orange-500 rounded-lg font-medium transition-colors"
                  >
                    Learn More
                  </Link>
                  <a
                    href="https://twitter.com/intent/tweet?text=Check%20out%20ScamScrammer%20-%20AI%20that%20wastes%20scammers%27%20time%20so%20they%20can%27t%20scam%20real%20people!"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                  >
                    Share on X
                  </a>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              ScamScrammer &mdash; Wasting scammers&apos; time so they can&apos;t waste yours.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
                Home
              </Link>
              <Link href="/calls" className="text-sm text-gray-400 hover:text-white transition-colors">
                All Calls
              </Link>
              <Link href="/hall-of-fame" className="text-sm text-orange-400 hover:text-orange-300 transition-colors">
                Hall of Fame
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

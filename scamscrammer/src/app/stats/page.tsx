'use client';

/**
 * Statistics and Leaderboard Dashboard
 *
 * Displays engaging statistics about scam calls, including:
 * - Total time wasted (hero stat with animated counter)
 * - Leaderboards for longest calls, highest rated, best persona
 * - Charts showing call trends, persona breakdown, peak hours
 * - Fun stats like scammer salary wasted
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

interface DashboardStats {
  totalCalls: number;
  totalDuration: number;
  averageDuration: number;
  callsByStatus: Record<string, number>;
  callsByDay: Array<{ date: string; count: number }>;
}

interface LeaderboardData {
  longestCall: {
    id: string;
    duration: number;
    persona: string | null;
    createdAt: string;
  } | null;
  highestRatedCall: {
    id: string;
    rating: number;
    persona: string | null;
    duration: number | null;
    createdAt: string;
  } | null;
  mostCallsInDay: {
    date: string;
    count: number;
  } | null;
  bestPersonaByDuration: {
    persona: string;
    avgDuration: number;
    totalCalls: number;
  } | null;
  bestPersonaByRating: {
    persona: string;
    avgRating: number;
    totalCalls: number;
  } | null;
  personaBreakdown: Array<{
    persona: string;
    totalCalls: number;
    totalDuration: number;
    avgDuration: number;
    avgRating: number | null;
  }>;
  peakHours: Array<{ hour: number; count: number }>;
  totalTimeWasted: number;
  estimatedScammerSalaryWasted: number;
  totalRageQuits: number;
}

const PERSONA_COLORS: Record<string, string> = {
  earl: '#F97316',
  gladys: '#8B5CF6',
  kevin: '#22C55E',
  brenda: '#EC4899',
};

const PERSONA_EMOJIS: Record<string, string> = {
  earl: '👴',
  gladys: '👵',
  kevin: '🧔',
  brenda: '💁',
};

const PERSONA_NAMES: Record<string, string> = {
  earl: 'Earl',
  gladys: 'Gladys',
  kevin: 'Kevin',
  brenda: 'Brenda',
};

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatDurationShort(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const stepValue = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += stepValue;
      if (current >= value) {
        setDisplayed(value);
        clearInterval(timer);
      } else {
        setDisplayed(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {displayed.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, leaderboardRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/stats/leaderboard'),
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        if (leaderboardRes.ok) {
          const leaderboardData = await leaderboardRes.json();
          setLeaderboard(leaderboardData);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-8">
            <div className="h-48 bg-gray-800 rounded-xl"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-800 rounded-lg"></div>
              ))}
            </div>
            <div className="h-64 bg-gray-800 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  const totalMinutes = Math.floor((leaderboard?.totalTimeWasted || 0) / 60);
  const totalHours = Math.floor(totalMinutes / 60);

  // Prepare chart data
  const pieData =
    leaderboard?.personaBreakdown.map((p) => ({
      name: PERSONA_NAMES[p.persona] || p.persona,
      value: p.totalCalls,
      color: PERSONA_COLORS[p.persona] || '#6B7280',
    })) || [];

  const hourlyData =
    leaderboard?.peakHours.map((h) => ({
      hour: `${h.hour.toString().padStart(2, '0')}:00`,
      calls: h.count,
    })) || [];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-gray-400 hover:text-white text-sm mb-4 inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold mt-2 flex items-center gap-3">
            <span className="text-4xl">📊</span>
            Scammer Time Wasted
          </h1>
          <p className="text-gray-400 mt-2">
            Every second counts when it comes to wasting scammers' time.
          </p>
        </div>

        {/* Hero Stats */}
        <div className="bg-gradient-to-br from-orange-900/50 to-red-900/50 rounded-xl p-8 mb-8 border border-orange-500/30">
          <div className="text-center">
            <div className="text-6xl md:text-8xl font-bold text-orange-400 mb-2">
              <AnimatedCounter value={totalHours} suffix="h " />
              <AnimatedCounter value={totalMinutes % 60} suffix="m" />
            </div>
            <div className="text-xl text-gray-300 mb-4">Total Scammer Time Wasted</div>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <div className="bg-black/30 rounded-lg px-4 py-2">
                <span className="text-green-400 font-bold">
                  ${leaderboard?.estimatedScammerSalaryWasted.toFixed(2) || '0.00'}
                </span>
                <span className="text-gray-400 ml-2">Scammer Wages Wasted</span>
              </div>
              <div className="bg-black/30 rounded-lg px-4 py-2">
                <span className="text-red-400 font-bold">{leaderboard?.totalRageQuits || 0}</span>
                <span className="text-gray-400 ml-2">Rage Quits</span>
              </div>
              <div className="bg-black/30 rounded-lg px-4 py-2">
                <span className="text-blue-400 font-bold">{stats?.totalCalls || 0}</span>
                <span className="text-gray-400 ml-2">Total Calls</span>
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {/* Longest Call */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🏆</span>
              <h3 className="font-semibold">Longest Call</h3>
            </div>
            {leaderboard?.longestCall ? (
              <div>
                <div className="text-3xl font-bold text-yellow-400 mb-2">
                  {formatDuration(leaderboard.longestCall.duration)}
                </div>
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <span className="text-xl">
                    {PERSONA_EMOJIS[leaderboard.longestCall.persona || 'earl']}
                  </span>
                  <span>{PERSONA_NAMES[leaderboard.longestCall.persona || 'earl']}</span>
                </div>
                <Link
                  href={`/calls/${leaderboard.longestCall.id}`}
                  className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block"
                >
                  Listen to call →
                </Link>
              </div>
            ) : (
              <div className="text-gray-500">No calls yet</div>
            )}
          </div>

          {/* Highest Rated */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">⭐</span>
              <h3 className="font-semibold">Highest Rated</h3>
            </div>
            {leaderboard?.highestRatedCall ? (
              <div>
                <div className="text-3xl font-bold text-yellow-400 mb-2">
                  {'★'.repeat(leaderboard.highestRatedCall.rating)}
                  {'☆'.repeat(5 - leaderboard.highestRatedCall.rating)}
                </div>
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <span className="text-xl">
                    {PERSONA_EMOJIS[leaderboard.highestRatedCall.persona || 'earl']}
                  </span>
                  <span>{PERSONA_NAMES[leaderboard.highestRatedCall.persona || 'earl']}</span>
                  {leaderboard.highestRatedCall.duration && (
                    <span className="text-gray-500">
                      ({formatDurationShort(leaderboard.highestRatedCall.duration)})
                    </span>
                  )}
                </div>
                <Link
                  href={`/calls/${leaderboard.highestRatedCall.id}`}
                  className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block"
                >
                  Listen to call →
                </Link>
              </div>
            ) : (
              <div className="text-gray-500">No rated calls yet</div>
            )}
          </div>

          {/* Best Persona */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">👑</span>
              <h3 className="font-semibold">Best Persona (by Duration)</h3>
            </div>
            {leaderboard?.bestPersonaByDuration ? (
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-4xl">
                    {PERSONA_EMOJIS[leaderboard.bestPersonaByDuration.persona]}
                  </span>
                  <div>
                    <div
                      className="text-2xl font-bold"
                      style={{
                        color: PERSONA_COLORS[leaderboard.bestPersonaByDuration.persona],
                      }}
                    >
                      {PERSONA_NAMES[leaderboard.bestPersonaByDuration.persona]}
                    </div>
                    <div className="text-sm text-gray-400">
                      Avg: {formatDurationShort(leaderboard.bestPersonaByDuration.avgDuration)} per
                      call
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {leaderboard.bestPersonaByDuration.totalCalls} calls handled
                </div>
              </div>
            ) : (
              <div className="text-gray-500">No data yet</div>
            )}
          </div>

          {/* Busiest Day */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📅</span>
              <h3 className="font-semibold">Busiest Day</h3>
            </div>
            {leaderboard?.mostCallsInDay ? (
              <div>
                <div className="text-3xl font-bold text-purple-400 mb-2">
                  {leaderboard.mostCallsInDay.count} calls
                </div>
                <div className="text-gray-400 text-sm">
                  {new Date(leaderboard.mostCallsInDay.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
            ) : (
              <div className="text-gray-500">No calls yet</div>
            )}
          </div>

          {/* Average Duration */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">⏱️</span>
              <h3 className="font-semibold">Average Call Duration</h3>
            </div>
            <div className="text-3xl font-bold text-cyan-400 mb-2">
              {formatDuration(stats?.averageDuration || 0)}
            </div>
            <div className="text-gray-400 text-sm">Across all completed calls</div>
          </div>

          {/* Calls by Status */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📞</span>
              <h3 className="font-semibold">Call Status</h3>
            </div>
            <div className="space-y-2">
              {stats?.callsByStatus &&
                Object.entries(stats.callsByStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between text-sm">
                    <span className="text-gray-400">{status}</span>
                    <span
                      className={`font-medium ${
                        status === 'COMPLETED'
                          ? 'text-green-400'
                          : status === 'IN_PROGRESS'
                            ? 'text-yellow-400'
                            : status === 'FAILED'
                              ? 'text-red-400'
                              : 'text-gray-300'
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Calls Per Day Chart */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <span className="text-xl">📈</span>
              Calls Per Day (Last 30 Days)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.callsByDay || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#9CA3AF' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#F97316"
                    strokeWidth={2}
                    dot={{ fill: '#F97316', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Persona Usage Pie Chart */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <span className="text-xl">🥧</span>
              Persona Usage Breakdown
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={{ stroke: '#6B7280' }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                    formatter={(value) => [`${value ?? 0} calls`, 'Total']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Peak Hours Chart */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 lg:col-span-2">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <span className="text-xl">🕐</span>
              Peak Calling Hours (When Do Scammers Call?)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="hour" stroke="#9CA3AF" fontSize={11} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#9CA3AF' }}
                    formatter={(value) => [`${value ?? 0} calls`, 'Calls']}
                  />
                  <Bar dataKey="calls" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Persona Comparison Table */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span className="text-xl">👥</span>
            Persona Performance Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="pb-3 text-gray-400 font-medium">Persona</th>
                  <th className="pb-3 text-gray-400 font-medium text-right">Total Calls</th>
                  <th className="pb-3 text-gray-400 font-medium text-right">Total Time</th>
                  <th className="pb-3 text-gray-400 font-medium text-right">Avg Duration</th>
                  <th className="pb-3 text-gray-400 font-medium text-right">Avg Rating</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard?.personaBreakdown.map((persona) => (
                  <tr key={persona.persona} className="border-b border-gray-700/50">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{PERSONA_EMOJIS[persona.persona]}</span>
                        <span
                          className="font-medium"
                          style={{ color: PERSONA_COLORS[persona.persona] }}
                        >
                          {PERSONA_NAMES[persona.persona]}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-right">{persona.totalCalls}</td>
                    <td className="py-3 text-right">{formatDurationShort(persona.totalDuration)}</td>
                    <td className="py-3 text-right">{formatDurationShort(persona.avgDuration)}</td>
                    <td className="py-3 text-right">
                      {persona.avgRating ? (
                        <span className="text-yellow-400">
                          {'★'.repeat(Math.round(persona.avgRating))}
                          <span className="text-gray-600">
                            {'★'.repeat(5 - Math.round(persona.avgRating))}
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fun Facts Footer */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-800/50 rounded-lg p-6 border border-gray-700 text-center">
          <h3 className="font-semibold mb-4">Fun Facts</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-black/20 rounded-lg p-4">
              <div className="text-2xl mb-2">💰</div>
              <div className="text-green-400 font-bold">
                ${((leaderboard?.totalTimeWasted || 0) / 3600 * 3).toFixed(2)}
              </div>
              <div className="text-gray-400">In scammer wages we've prevented from going to fraud</div>
            </div>
            <div className="bg-black/20 rounded-lg p-4">
              <div className="text-2xl mb-2">😤</div>
              <div className="text-red-400 font-bold">{leaderboard?.totalRageQuits || 0}</div>
              <div className="text-gray-400">Scammers have rage-quit on our AI personas</div>
            </div>
            <div className="bg-black/20 rounded-lg p-4">
              <div className="text-2xl mb-2">🎯</div>
              <div className="text-blue-400 font-bold">
                {stats?.totalCalls
                  ? Math.round(((stats.callsByStatus?.COMPLETED || 0) / stats.totalCalls) * 100)
                  : 0}
                %
              </div>
              <div className="text-gray-400">Call completion rate</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

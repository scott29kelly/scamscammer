'use client';

import { useState } from 'react';
import Link from 'next/link';
import ApiEndpoint from '@/components/docs/ApiEndpoint';
import CodeBlock from '@/components/docs/CodeBlock';

type Section =
  | 'overview'
  | 'authentication'
  | 'rate-limits'
  | 'endpoints'
  | 'errors'
  | 'webhooks';

const sections: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'rate-limits', label: 'Rate Limits' },
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'errors', label: 'Error Handling' },
  { id: 'webhooks', label: 'Webhooks' },
];

export default function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState<Section>('overview');

  const scrollToSection = (sectionId: Section) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-gray-900/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <span className="text-xl">🎣</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">ScamScrammer</h1>
                  <p className="text-xs text-gray-400">API Documentation</p>
                </div>
              </Link>
            </div>
            <nav className="flex items-center gap-4">
              <Link
                href="/"
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                Dashboard
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <nav className="sticky top-24 space-y-1">
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Documentation
              </h3>
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                    activeSection === section.id
                      ? 'bg-orange-500/20 text-orange-400 font-medium'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  {section.label}
                </button>
              ))}
              <div className="pt-6 mt-6 border-t border-gray-800">
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Resources
                </h3>
                <a
                  href="mailto:api@scamscrammer.com"
                  className="w-full text-left px-3 py-2 text-sm rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Contact Support
                </a>
              </div>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Page Title */}
            <div className="mb-12">
              <h1 className="text-4xl font-bold text-white mb-4">
                ScamScrammer API Documentation
              </h1>
              <p className="text-lg text-gray-400 max-w-3xl">
                Build integrations with ScamScrammer to access scam call data, analytics, and more.
                Our API provides programmatic access to call recordings, transcripts, and statistics.
              </p>
              <div className="mt-6 flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  API Status: Operational
                </div>
                <span className="text-sm text-gray-500">
                  v1.0.0
                </span>
              </div>
            </div>

            {/* Overview Section */}
            <section id="overview" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                Overview
              </h2>
              <div className="prose prose-invert max-w-none">
                <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700 space-y-4">
                  <p className="text-gray-300">
                    The ScamScrammer API provides access to our scam call interception and analysis platform.
                    Use our API to retrieve call data, view transcripts, and integrate scam prevention
                    analytics into your applications.
                  </p>
                  <h3 className="text-lg font-semibold text-white mt-6 mb-3">Use Cases</h3>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { icon: '📊', text: 'Analytics dashboards for scam call tracking' },
                      { icon: '🔔', text: 'Real-time notifications for new scam calls' },
                      { icon: '📱', text: 'Mobile app integration for call playback' },
                      { icon: '🤖', text: 'Machine learning training data for scam detection' },
                      { icon: '📈', text: 'Business intelligence and reporting' },
                      { icon: '🛡️', text: 'Security research and scam pattern analysis' },
                    ].map((item, index) => (
                      <li key={index} className="flex items-center gap-3 text-gray-400">
                        <span className="text-xl">{item.icon}</span>
                        {item.text}
                      </li>
                    ))}
                  </ul>
                  <h3 className="text-lg font-semibold text-white mt-6 mb-3">Base URL</h3>
                  <CodeBlock code="https://scamscrammer.com/api" language="bash" />
                </div>
              </div>
            </section>

            {/* Authentication Section */}
            <section id="authentication" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </span>
                Authentication
              </h2>
              <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700 space-y-4">
                <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-blue-400 mb-1">Public Endpoints Available</h4>
                    <p className="text-sm text-gray-400">
                      Currently, all public API endpoints are available without authentication.
                      API key authentication will be required for enterprise and commercial use in a future release.
                    </p>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-white mt-4">Future: API Key Authentication</h3>
                <p className="text-gray-400">
                  When API keys are implemented, you will authenticate requests by including your API key
                  in the <code className="px-1.5 py-0.5 bg-gray-700 rounded text-purple-400">Authorization</code> header:
                </p>
                <CodeBlock
                  code={`curl -X GET "https://scamscrammer.com/api/calls" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
                  language="bash"
                  title="Example with API Key (Future)"
                />
                <p className="text-sm text-gray-500 mt-4">
                  Contact us at <a href="mailto:api@scamscrammer.com" className="text-orange-400 hover:underline">api@scamscrammer.com</a> to
                  request early access to authenticated API features for enterprise use.
                </p>
              </div>
            </section>

            {/* Rate Limits Section */}
            <section id="rate-limits" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                Rate Limits
              </h2>
              <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700">
                <p className="text-gray-300 mb-6">
                  To ensure fair usage and system stability, the API enforces rate limits on all endpoints.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {[
                    { label: 'Requests per minute', value: '100', tier: 'Free Tier' },
                    { label: 'Requests per minute', value: '1,000', tier: 'Pro Tier' },
                    { label: 'Requests per minute', value: 'Unlimited', tier: 'Enterprise' },
                  ].map((item, index) => (
                    <div key={index} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                      <p className="text-sm text-gray-500 mb-1">{item.tier}</p>
                      <p className="text-2xl font-bold text-white">{item.value}</p>
                      <p className="text-xs text-gray-400">{item.label}</p>
                    </div>
                  ))}
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">Rate Limit Headers</h3>
                <p className="text-gray-400 mb-4">
                  Rate limit information is included in all API responses via the following headers:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 font-semibold text-gray-300 bg-gray-800/50">Header</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-300 bg-gray-800/50">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      <tr>
                        <td className="py-3 px-4">
                          <code className="text-purple-400">X-RateLimit-Limit</code>
                        </td>
                        <td className="py-3 px-4 text-gray-400">Maximum requests per minute</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4">
                          <code className="text-purple-400">X-RateLimit-Remaining</code>
                        </td>
                        <td className="py-3 px-4 text-gray-400">Requests remaining in current window</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4">
                          <code className="text-purple-400">X-RateLimit-Reset</code>
                        </td>
                        <td className="py-3 px-4 text-gray-400">Unix timestamp when the rate limit resets</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Endpoints Section */}
            <section id="endpoints" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
                Endpoints
              </h2>
              <div className="space-y-6">
                {/* Health Check */}
                <ApiEndpoint
                  method="GET"
                  path="/api/health"
                  description="Returns the health status of the API and its dependencies. Use this endpoint for monitoring, load balancer health checks, and deployment verification."
                  exampleResponse={JSON.stringify(
                    {
                      status: 'healthy',
                      timestamp: '2024-01-15T10:30:00.000Z',
                      version: '1.0.0',
                      services: {
                        database: {
                          status: 'up',
                          latency: 12,
                        },
                      },
                    },
                    null,
                    2
                  )}
                  responseDescription="Health status of all services"
                />

                {/* Stats */}
                <ApiEndpoint
                  method="GET"
                  path="/api/stats"
                  description="Returns dashboard statistics including total calls, duration metrics, calls by status, and daily call volume for the last 30 days."
                  exampleResponse={JSON.stringify(
                    {
                      totalCalls: 1250,
                      totalDuration: 87420,
                      averageDuration: 245,
                      callsByStatus: {
                        COMPLETED: 890,
                        IN_PROGRESS: 5,
                        RINGING: 2,
                        FAILED: 120,
                        NO_ANSWER: 233,
                      },
                      callsByDay: [
                        { date: '2024-01-01', count: 42 },
                        { date: '2024-01-02', count: 38 },
                      ],
                      topRatedCalls: [],
                      longestCalls: [],
                    },
                    null,
                    2
                  )}
                  responseDescription="Dashboard statistics and metrics"
                />

                {/* List Calls */}
                <ApiEndpoint
                  method="GET"
                  path="/api/calls"
                  description="Returns a paginated list of calls with filtering and sorting options. Use query parameters to filter by status, date range, rating, and more."
                  queryParameters={[
                    {
                      name: 'page',
                      type: 'number',
                      required: false,
                      description: 'Page number for pagination',
                      default: '1',
                    },
                    {
                      name: 'limit',
                      type: 'number',
                      required: false,
                      description: 'Number of results per page (max: 100)',
                      default: '20',
                    },
                    {
                      name: 'status',
                      type: 'string',
                      required: false,
                      description: 'Filter by call status (COMPLETED, IN_PROGRESS, RINGING, FAILED, NO_ANSWER)',
                    },
                    {
                      name: 'search',
                      type: 'string',
                      required: false,
                      description: 'Search by phone number or notes',
                    },
                    {
                      name: 'minRating',
                      type: 'number',
                      required: false,
                      description: 'Filter calls with rating >= this value (1-5)',
                    },
                    {
                      name: 'tag',
                      type: 'string',
                      required: false,
                      description: 'Filter by tag',
                    },
                    {
                      name: 'startDate',
                      type: 'string',
                      required: false,
                      description: 'Filter calls from this date (ISO 8601 format)',
                    },
                    {
                      name: 'endDate',
                      type: 'string',
                      required: false,
                      description: 'Filter calls until this date (ISO 8601 format)',
                    },
                    {
                      name: 'sortBy',
                      type: 'string',
                      required: false,
                      description: 'Sort field (createdAt, duration, rating)',
                      default: 'createdAt',
                    },
                    {
                      name: 'sortOrder',
                      type: 'string',
                      required: false,
                      description: 'Sort order (asc, desc)',
                      default: 'desc',
                    },
                  ]}
                  exampleResponse={JSON.stringify(
                    {
                      calls: [
                        {
                          id: 'clx1234567890',
                          twilioSid: 'CA1234567890abcdef',
                          fromNumber: '+15551234567',
                          toNumber: '+15559876543',
                          status: 'COMPLETED',
                          duration: 342,
                          recordingUrl: 'https://storage.example.com/recordings/abc.mp3',
                          transcriptUrl: null,
                          rating: 5,
                          notes: 'IRS scam attempt',
                          tags: ['irs', 'tax-scam'],
                          createdAt: '2024-01-15T10:30:00.000Z',
                          updatedAt: '2024-01-15T10:35:42.000Z',
                          _count: { segments: 24 },
                        },
                      ],
                      pagination: {
                        total: 150,
                        page: 1,
                        limit: 20,
                        totalPages: 8,
                        hasNext: true,
                        hasPrev: false,
                      },
                    },
                    null,
                    2
                  )}
                  responseDescription="Paginated list of calls"
                />

                {/* Get Single Call */}
                <ApiEndpoint
                  method="GET"
                  path="/api/calls/:id"
                  description="Returns detailed information about a single call, including all transcript segments ordered by timestamp."
                  parameters={[
                    {
                      name: 'id',
                      type: 'string',
                      required: true,
                      description: 'Unique identifier of the call',
                    },
                  ]}
                  exampleResponse={JSON.stringify(
                    {
                      id: 'clx1234567890',
                      twilioSid: 'CA1234567890abcdef',
                      fromNumber: '+15551234567',
                      toNumber: '+15559876543',
                      status: 'COMPLETED',
                      duration: 342,
                      recordingUrl: 'https://storage.example.com/recordings/abc.mp3',
                      transcriptUrl: 'https://storage.example.com/transcripts/abc.json',
                      rating: 5,
                      notes: 'IRS scam attempt - caller claimed victim owed back taxes',
                      tags: ['irs', 'tax-scam', 'featured'],
                      createdAt: '2024-01-15T10:30:00.000Z',
                      updatedAt: '2024-01-15T10:35:42.000Z',
                      segments: [
                        {
                          id: 'seg_001',
                          callId: 'clx1234567890',
                          speaker: 'SCAMMER',
                          text: 'Hello, this is the IRS calling about your tax debt.',
                          timestamp: 0,
                          createdAt: '2024-01-15T10:30:05.000Z',
                        },
                        {
                          id: 'seg_002',
                          callId: 'clx1234567890',
                          speaker: 'EARL',
                          text: "Oh my, the IRS? Hold on, let me find my hearing aid... What's that now?",
                          timestamp: 3500,
                          createdAt: '2024-01-15T10:30:08.500Z',
                        },
                      ],
                    },
                    null,
                    2
                  )}
                  responseDescription="Full call details with transcript segments"
                />
              </div>
            </section>

            {/* Error Handling Section */}
            <section id="errors" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </span>
                Error Handling
              </h2>
              <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700 space-y-6">
                <p className="text-gray-300">
                  The API uses standard HTTP status codes to indicate the success or failure of requests.
                  All error responses follow a consistent JSON format.
                </p>

                <h3 className="text-lg font-semibold text-white">Error Response Format</h3>
                <CodeBlock
                  code={JSON.stringify(
                    {
                      error: 'Human-readable error message',
                      code: 'ERROR_CODE',
                      details: {
                        field: 'Additional context about the error',
                      },
                      requestId: 'req_abc123',
                    },
                    null,
                    2
                  )}
                  language="json"
                />

                <h3 className="text-lg font-semibold text-white mt-6">HTTP Status Codes</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 font-semibold text-gray-300 bg-gray-800/50">Status Code</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-300 bg-gray-800/50">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {[
                        { code: '200 OK', desc: 'Request succeeded' },
                        { code: '400 Bad Request', desc: 'Invalid request parameters or body' },
                        { code: '401 Unauthorized', desc: 'Missing or invalid API key (future)' },
                        { code: '403 Forbidden', desc: 'API key lacks required permissions' },
                        { code: '404 Not Found', desc: 'Requested resource does not exist' },
                        { code: '429 Too Many Requests', desc: 'Rate limit exceeded' },
                        { code: '500 Internal Server Error', desc: 'Server error - contact support' },
                        { code: '503 Service Unavailable', desc: 'Service temporarily unavailable' },
                      ].map((item) => (
                        <tr key={item.code}>
                          <td className="py-3 px-4">
                            <code className="text-orange-400">{item.code}</code>
                          </td>
                          <td className="py-3 px-4 text-gray-400">{item.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h3 className="text-lg font-semibold text-white mt-6">Example Error Response</h3>
                <CodeBlock
                  code={JSON.stringify(
                    {
                      error: 'Call not found',
                      code: 'NOT_FOUND',
                      requestId: 'req_xyz789',
                    },
                    null,
                    2
                  )}
                  language="json"
                  title="404 Not Found"
                />
              </div>
            </section>

            {/* Webhooks Section */}
            <section id="webhooks" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </span>
                Webhooks
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-700 text-gray-400 ml-2">
                  Coming Soon
                </span>
              </h2>
              <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700 space-y-4">
                <div className="flex items-start gap-3 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                  <svg className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-indigo-400 mb-1">Feature in Development</h4>
                    <p className="text-sm text-gray-400">
                      Webhooks are planned for a future release. Subscribe to notifications for new calls,
                      call completions, and high-value scam detections.
                    </p>
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-white mt-4">Planned Webhook Events</h3>
                <ul className="space-y-3">
                  {[
                    { event: 'call.started', desc: 'Triggered when a new scam call is received' },
                    { event: 'call.completed', desc: 'Triggered when a call ends with full transcript' },
                    { event: 'call.rated', desc: 'Triggered when a call receives a high rating' },
                    { event: 'scam.detected', desc: 'Triggered when a new scam pattern is identified' },
                  ].map((item) => (
                    <li key={item.event} className="flex items-start gap-3 text-gray-400">
                      <code className="px-2 py-0.5 bg-gray-700 rounded text-purple-400 text-sm flex-shrink-0">
                        {item.event}
                      </code>
                      <span>{item.desc}</span>
                    </li>
                  ))}
                </ul>

                <p className="text-sm text-gray-500 mt-6">
                  Interested in webhook access? Contact us at{' '}
                  <a href="mailto:api@scamscrammer.com" className="text-orange-400 hover:underline">
                    api@scamscrammer.com
                  </a>{' '}
                  to be notified when webhooks are available.
                </p>
              </div>
            </section>

            {/* CTA Section */}
            <section className="p-8 bg-gradient-to-r from-orange-600/20 to-red-600/20 rounded-xl border border-orange-500/20">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Ready to integrate?
                  </h3>
                  <p className="text-gray-400">
                    Get in touch to discuss enterprise API access, custom integrations, and licensing options.
                  </p>
                </div>
                <a
                  href="mailto:api@scamscrammer.com"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Contact Us
                </a>
              </div>
            </section>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="text-sm text-gray-500">
              ScamScrammer API v1.0.0 &mdash; Wasting scammers&apos; time so they can&apos;t waste yours.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
                Dashboard
              </Link>
              <Link href="/calls" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
                All Calls
              </Link>
              <a
                href="mailto:api@scamscrammer.com"
                className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                API Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

'use client';

/**
 * Calls Page
 *
 * Displays the list of all calls with filtering, sorting, and pagination.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CallList from '@/components/CallList';
import type { CallListItem, PaginationInfo } from '@/types';
import { CallStatus } from '@prisma/client';

interface CallsState {
  calls: CallListItem[];
  pagination: PaginationInfo | null;
  isLoading: boolean;
  error: string | null;
}

export default function CallsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get initial state from URL params
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const initialStatus = searchParams.get('status') as CallStatus | undefined;
  const initialSortBy = (searchParams.get('sortBy') as 'createdAt' | 'duration' | 'rating') || 'createdAt';
  const initialSortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
  const initialSearch = searchParams.get('search') || '';

  const [state, setState] = useState<CallsState>({
    calls: [],
    pagination: null,
    isLoading: true,
    error: null,
  });

  const [page, setPage] = useState(initialPage);
  const [status, setStatus] = useState<CallStatus | undefined>(initialStatus || undefined);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [searchInput, setSearchInput] = useState(initialSearch);

  // Update URL when filters change
  const updateUrl = useCallback((params: Record<string, string | undefined>) => {
    const newParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== 'undefined') {
        newParams.set(key, value);
      }
    });
    const queryString = newParams.toString();
    router.push(queryString ? `/calls?${queryString}` : '/calls', { scroll: false });
  }, [router]);

  // Fetch calls from API
  const fetchCalls = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);

      if (status) {
        params.set('status', status);
      }
      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const response = await fetch(`/api/calls?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch calls');
      }

      const data = await response.json();
      setState({
        calls: data.calls,
        pagination: data.pagination,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'An error occurred',
      }));
    }
  }, [page, status, sortBy, sortOrder, searchQuery]);

  // Fetch calls on mount and when filters change
  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  // Update URL when filters change
  useEffect(() => {
    updateUrl({
      page: page > 1 ? page.toString() : undefined,
      status,
      sortBy: sortBy !== 'createdAt' ? sortBy : undefined,
      sortOrder: sortOrder !== 'desc' ? sortOrder : undefined,
      search: searchQuery || undefined,
    });
  }, [page, status, sortBy, sortOrder, searchQuery, updateUrl]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleStatusFilter = (newStatus: CallStatus | undefined) => {
    setStatus(newStatus);
    setPage(1); // Reset to first page when filtering
  };

  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy as 'createdAt' | 'duration' | 'rating');
    setSortOrder(newSortOrder);
    setPage(1); // Reset to first page when sorting
  };

  const handleCallClick = (callId: string) => {
    router.push(`/calls/${callId}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Calls</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Browse and manage all recorded scam calls
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by phone number or notes..."
                className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Search
            </button>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSearchQuery('');
                  setPage(1);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {/* Error Message */}
        {state.error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{state.error}</p>
            <button
              onClick={fetchCalls}
              className="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Call List */}
        {state.pagination && (
          <CallList
            calls={state.calls}
            pagination={state.pagination}
            onPageChange={handlePageChange}
            onCallClick={handleCallClick}
            onStatusFilter={handleStatusFilter}
            onSortChange={handleSortChange}
            currentStatus={status}
            currentSortBy={sortBy}
            currentSortOrder={sortOrder}
            isLoading={state.isLoading}
          />
        )}

        {/* Loading state for initial load */}
        {state.isLoading && !state.pagination && (
          <div className="animate-pulse">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded mb-2" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

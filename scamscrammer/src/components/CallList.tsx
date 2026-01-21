'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CallListItem, CallListResponse, PaginationInfo } from '@/types';
import { CallStatus } from '@prisma/client';

interface CallListProps {
  initialCalls?: CallListItem[];
  initialPagination?: PaginationInfo;
  onCallClick?: (call: CallListItem) => void;
}

type SortField = 'createdAt' | 'duration' | 'rating';
type SortOrder = 'asc' | 'desc';

interface Filters {
  status: string;
  search: string;
  minRating: string;
}

const STATUS_COLORS: Record<string, string> = {
  RINGING: 'bg-yellow-500/20 text-yellow-400',
  IN_PROGRESS: 'bg-blue-500/20 text-blue-400',
  COMPLETED: 'bg-green-500/20 text-green-400',
  FAILED: 'bg-red-500/20 text-red-400',
  NO_ANSWER: 'bg-gray-500/20 text-gray-400',
};

const STATUS_LABELS: Record<string, string> = {
  RINGING: 'Ringing',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  NO_ANSWER: 'No Answer',
};

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatPhoneNumber(phone: string): string {
  // Format US phone numbers
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

function RatingStars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-gray-600">-</span>;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={star <= rating ? 'text-yellow-400' : 'text-gray-600'}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default function CallList({
  initialCalls = [],
  initialPagination,
  onCallClick,
}: CallListProps) {
  const [calls, setCalls] = useState<CallListItem[]>(initialCalls);
  const [pagination, setPagination] = useState<PaginationInfo>(
    initialPagination || {
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    }
  );
  const [loading, setLoading] = useState(!initialCalls.length);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    status: '',
    search: '',
    minRating: '',
  });
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const fetchCalls = useCallback(async (page: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(pagination.limit));
      params.set('sortBy', sortField);
      params.set('sortOrder', sortOrder);

      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);
      if (filters.minRating) params.set('minRating', filters.minRating);

      const response = await fetch(`/api/calls?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch calls');
      }

      const data: CallListResponse = await response.json();
      setCalls(data.calls);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [filters, sortField, sortOrder, pagination.limit]);

  useEffect(() => {
    if (!initialCalls.length) {
      fetchCalls(1);
    }
  }, [fetchCalls, initialCalls.length]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleApplyFilters = () => {
    fetchCalls(1);
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  useEffect(() => {
    if (!loading) {
      fetchCalls(1);
    }
    // Only re-fetch when sort changes, not on initial load
  }, [sortField, sortOrder]);

  const handlePageChange = (newPage: number) => {
    fetchCalls(newPage);
  };

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-600">↕</span>;
    return <span className="text-blue-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="w-full">
      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm text-gray-400 mb-1">Search</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
            placeholder="Phone number or notes..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="w-40">
          <label className="block text-sm text-gray-400 mb-1">Status</label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            {Object.values(CallStatus).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="w-32">
          <label className="block text-sm text-gray-400 mb-1">Min Rating</label>
          <select
            value={filters.minRating}
            onChange={(e) => handleFilterChange('minRating', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Any</option>
            {[1, 2, 3, 4, 5].map((rating) => (
              <option key={rating} value={rating}>
                {rating}+ ★
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleApplyFilters}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Apply
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && calls.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">No calls found</div>
          <p className="text-gray-500 text-sm">
            {filters.status || filters.search || filters.minRating
              ? 'Try adjusting your filters'
              : 'Calls will appear here once they are received'}
          </p>
        </div>
      )}

      {/* Call List Table */}
      {!loading && !error && calls.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th
                    className="pb-3 pr-4 cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('createdAt')}
                  >
                    Date <SortIndicator field="createdAt" />
                  </th>
                  <th className="pb-3 pr-4">From</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th
                    className="pb-3 pr-4 cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('duration')}
                  >
                    Duration <SortIndicator field="duration" />
                  </th>
                  <th
                    className="pb-3 pr-4 cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('rating')}
                  >
                    Rating <SortIndicator field="rating" />
                  </th>
                  <th className="pb-3">Segments</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr
                    key={call.id}
                    onClick={() => onCallClick?.(call)}
                    className={`border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors ${
                      onCallClick ? 'cursor-pointer' : ''
                    }`}
                  >
                    <td className="py-4 pr-4">
                      <div className="text-white">{formatDate(call.createdAt)}</div>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="text-white font-mono">
                        {formatPhoneNumber(call.fromNumber)}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          STATUS_COLORS[call.status] || 'bg-gray-500/20 text-gray-400'
                        }`}
                      >
                        {STATUS_LABELS[call.status] || call.status}
                      </span>
                    </td>
                    <td className="py-4 pr-4">
                      <span className="text-white font-mono">
                        {formatDuration(call.duration)}
                      </span>
                    </td>
                    <td className="py-4 pr-4">
                      <RatingStars rating={call.rating} />
                    </td>
                    <td className="py-4">
                      <span className="text-gray-400">{call._count.segments}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <div className="text-gray-400 text-sm">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} calls
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={!pagination.hasPrev}
                className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-gray-400">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={!pagination.hasNext}
                className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

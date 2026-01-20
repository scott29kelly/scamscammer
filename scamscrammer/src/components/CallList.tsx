'use client';

/**
 * CallList Component
 *
 * Displays a paginated list of calls with sorting, filtering, and navigation.
 */

import { useState } from 'react';
import type { CallListItem, PaginationInfo } from '@/types';
import { CallStatus } from '@prisma/client';

interface CallListProps {
  calls: CallListItem[];
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  onCallClick?: (callId: string) => void;
  onStatusFilter?: (status: CallStatus | undefined) => void;
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  currentStatus?: CallStatus;
  currentSortBy?: string;
  currentSortOrder?: 'asc' | 'desc';
  isLoading?: boolean;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPhoneNumber(phone: string): string {
  // Simple phone formatting for US numbers
  if (phone.startsWith('+1') && phone.length === 12) {
    return `(${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
  }
  return phone;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'IN_PROGRESS':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'RINGING':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'FAILED':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'NO_ANSWER':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
}

function RatingStars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-gray-400">-</span>;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={star <= rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default function CallList({
  calls,
  pagination,
  onPageChange,
  onCallClick,
  onStatusFilter,
  onSortChange,
  currentStatus,
  currentSortBy = 'createdAt',
  currentSortOrder = 'desc',
  isLoading = false,
}: CallListProps) {
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const handleSort = (field: string) => {
    if (onSortChange) {
      const newOrder = currentSortBy === field && currentSortOrder === 'desc' ? 'asc' : 'desc';
      onSortChange(field, newOrder);
    }
    setSortMenuOpen(false);
  };

  const getSortIndicator = (field: string) => {
    if (currentSortBy !== field) return null;
    return currentSortOrder === 'asc' ? '↑' : '↓';
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded mb-2" />
        ))}
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-6xl mb-4">📞</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">No calls found</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {currentStatus
            ? `No calls with status "${currentStatus.replace('_', ' ')}"`
            : 'No calls have been recorded yet'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters and Sort Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Status Filter */}
        {onStatusFilter && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onStatusFilter(undefined)}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                !currentStatus
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              All
            </button>
            {Object.values(CallStatus).map((status) => (
              <button
                key={status}
                onClick={() => onStatusFilter(status)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  currentStatus === status
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}

        {/* Sort Dropdown */}
        {onSortChange && (
          <div className="relative">
            <button
              onClick={() => setSortMenuOpen(!sortMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <span>Sort by: {currentSortBy}</span>
              <span className="text-xs">{currentSortOrder === 'asc' ? '↑' : '↓'}</span>
            </button>
            {sortMenuOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                {['createdAt', 'duration', 'rating'].map((field) => (
                  <button
                    key={field}
                    onClick={() => handleSort(field)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
                  >
                    {field === 'createdAt' ? 'Date' : field.charAt(0).toUpperCase() + field.slice(1)}
                    {currentSortBy === field && (
                      <span className="float-right">{getSortIndicator(field)}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Call Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('createdAt')}
              >
                Date {getSortIndicator('createdAt')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                From
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('duration')}
              >
                Duration {getSortIndicator('duration')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('rating')}
              >
                Rating {getSortIndicator('rating')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Segments
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {calls.map((call) => (
              <tr
                key={call.id}
                onClick={() => onCallClick?.(call.id)}
                className={`${
                  onCallClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''
                } transition-colors`}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {formatDate(call.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-mono">
                  {formatPhoneNumber(call.fromNumber)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                      call.status
                    )}`}
                  >
                    {call.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-mono">
                  {formatDuration(call.duration)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <RatingStars rating={call.rating} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {call._count.segments}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing{' '}
          <span className="font-medium">
            {(pagination.page - 1) * pagination.limit + 1}
          </span>{' '}
          to{' '}
          <span className="font-medium">
            {Math.min(pagination.page * pagination.limit, pagination.total)}
          </span>{' '}
          of <span className="font-medium">{pagination.total}</span> calls
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={!pagination.hasPrev}
            className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
              pagination.hasPrev
                ? 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
          >
            Previous
          </button>
          <div className="flex items-center gap-1">
            {/* Page numbers */}
            {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (pagination.page <= 3) {
                pageNum = i + 1;
              } else if (pagination.page >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = pagination.page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`w-10 h-10 text-sm rounded-lg transition-colors ${
                    pagination.page === pageNum
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={!pagination.hasNext}
            className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
              pagination.hasNext
                ? 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

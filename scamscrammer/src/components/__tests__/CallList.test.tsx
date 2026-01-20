/**
 * CallList Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import CallList from '../CallList';
import type { CallListItem, PaginationInfo } from '@/types';
import { CallStatus } from '@prisma/client';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}));

const mockCalls: CallListItem[] = [
  {
    id: 'call-1',
    twilioSid: 'CA123',
    fromNumber: '+15551234567',
    toNumber: '+15559876543',
    status: CallStatus.COMPLETED,
    duration: 300,
    recordingUrl: 'https://example.com/recording1.mp3',
    transcriptUrl: null,
    rating: 5,
    notes: 'Great call',
    tags: ['funny'],
    createdAt: new Date('2026-01-15T10:00:00Z'),
    updatedAt: new Date('2026-01-15T10:05:00Z'),
    _count: { segments: 10 },
  },
  {
    id: 'call-2',
    twilioSid: 'CA456',
    fromNumber: '+15551234568',
    toNumber: '+15559876543',
    status: CallStatus.IN_PROGRESS,
    duration: null,
    recordingUrl: null,
    transcriptUrl: null,
    rating: null,
    notes: null,
    tags: [],
    createdAt: new Date('2026-01-14T10:00:00Z'),
    updatedAt: new Date('2026-01-14T10:10:00Z'),
    _count: { segments: 5 },
  },
];

const mockPagination: PaginationInfo = {
  total: 50,
  page: 1,
  limit: 20,
  totalPages: 3,
  hasNext: true,
  hasPrev: false,
};

describe('CallList Component', () => {
  const mockOnPageChange = jest.fn();
  const mockOnCallClick = jest.fn();
  const mockOnStatusFilter = jest.fn();
  const mockOnSortChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders calls in a table', () => {
    render(
      <CallList
        calls={mockCalls}
        pagination={mockPagination}
        onPageChange={mockOnPageChange}
      />
    );

    // Check table headers (using regex to handle sort indicators)
    expect(screen.getByText(/^Date/)).toBeInTheDocument();
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText(/^Duration/)).toBeInTheDocument();
    expect(screen.getByText(/^Rating/)).toBeInTheDocument();
    expect(screen.getByText('Segments')).toBeInTheDocument();

    // Check call data
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
    expect(screen.getByText('5:00')).toBeInTheDocument(); // 300 seconds = 5:00
    expect(screen.getByText('10')).toBeInTheDocument(); // segments count
    expect(screen.getByText('5')).toBeInTheDocument(); // segments count for second call
  });

  it('shows empty state when no calls', () => {
    render(
      <CallList
        calls={[]}
        pagination={{ ...mockPagination, total: 0, totalPages: 0 }}
        onPageChange={mockOnPageChange}
      />
    );

    expect(screen.getByText('No calls found')).toBeInTheDocument();
    expect(screen.getByText('No calls have been recorded yet')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <CallList
        calls={[]}
        pagination={mockPagination}
        onPageChange={mockOnPageChange}
        isLoading={true}
      />
    );

    // Check for skeleton loading divs
    const loadingElements = document.querySelectorAll('.animate-pulse');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('handles pagination correctly', () => {
    render(
      <CallList
        calls={mockCalls}
        pagination={mockPagination}
        onPageChange={mockOnPageChange}
      />
    );

    // Check pagination info exists (text is split across elements, so check container text)
    const paginationContainer = screen.getByText(/Showing/);
    expect(paginationContainer.closest('div')).toHaveTextContent(/Showing.*1.*to.*20.*of.*50.*calls/);

    // Previous should be disabled
    const prevButton = screen.getByText('Previous');
    expect(prevButton).toBeDisabled();

    // Next should be enabled
    const nextButton = screen.getByText('Next');
    expect(nextButton).not.toBeDisabled();

    // Click next
    fireEvent.click(nextButton);
    expect(mockOnPageChange).toHaveBeenCalledWith(2);
  });

  it('handles row click', () => {
    render(
      <CallList
        calls={mockCalls}
        pagination={mockPagination}
        onPageChange={mockOnPageChange}
        onCallClick={mockOnCallClick}
      />
    );

    // Click on a row
    const rows = screen.getAllByRole('row');
    // First row is header, second row is first data row
    fireEvent.click(rows[1]);
    expect(mockOnCallClick).toHaveBeenCalledWith('call-1');
  });

  it('shows status filter buttons when onStatusFilter is provided', () => {
    render(
      <CallList
        calls={mockCalls}
        pagination={mockPagination}
        onPageChange={mockOnPageChange}
        onStatusFilter={mockOnStatusFilter}
      />
    );

    // Check all status filters are shown (use getAllByText for those that appear in both filter and table)
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('RINGING')).toBeInTheDocument();
    expect(screen.getAllByText('IN PROGRESS').length).toBeGreaterThanOrEqual(1); // filter + possible badge
    expect(screen.getAllByText('COMPLETED').length).toBeGreaterThanOrEqual(1); // filter + possible badge
    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.getByText('NO ANSWER')).toBeInTheDocument();
  });

  it('handles status filter click', () => {
    render(
      <CallList
        calls={mockCalls}
        pagination={mockPagination}
        onPageChange={mockOnPageChange}
        onStatusFilter={mockOnStatusFilter}
      />
    );

    // Click on COMPLETED filter
    const completedButton = screen.getAllByText('COMPLETED')[0]; // Get the filter button, not status badge
    fireEvent.click(completedButton);
    expect(mockOnStatusFilter).toHaveBeenCalledWith(CallStatus.COMPLETED);
  });

  it('shows empty state with filter message when filtering', () => {
    render(
      <CallList
        calls={[]}
        pagination={{ ...mockPagination, total: 0, totalPages: 0 }}
        onPageChange={mockOnPageChange}
        currentStatus={CallStatus.FAILED}
      />
    );

    expect(screen.getByText('No calls found')).toBeInTheDocument();
    expect(screen.getByText('No calls with status "FAILED"')).toBeInTheDocument();
  });

  it('formats duration correctly', () => {
    render(
      <CallList
        calls={mockCalls}
        pagination={mockPagination}
        onPageChange={mockOnPageChange}
      />
    );

    // 300 seconds = 5:00
    expect(screen.getByText('5:00')).toBeInTheDocument();
    // null duration should show "-" (multiple "-" may exist for null duration and rating)
    const dashElements = screen.getAllByText('-');
    expect(dashElements.length).toBeGreaterThanOrEqual(1);
  });

  it('displays rating stars correctly', () => {
    render(
      <CallList
        calls={mockCalls}
        pagination={mockPagination}
        onPageChange={mockOnPageChange}
      />
    );

    // First call has rating 5 - should show 5 yellow stars
    const starContainers = document.querySelectorAll('.flex.gap-0\\.5');
    expect(starContainers.length).toBeGreaterThan(0);
  });

  it('shows sort controls when onSortChange is provided', () => {
    render(
      <CallList
        calls={mockCalls}
        pagination={mockPagination}
        onPageChange={mockOnPageChange}
        onSortChange={mockOnSortChange}
      />
    );

    expect(screen.getByText(/Sort by:/)).toBeInTheDocument();
  });

  it('handles sort dropdown interaction', () => {
    render(
      <CallList
        calls={mockCalls}
        pagination={mockPagination}
        onPageChange={mockOnPageChange}
        onSortChange={mockOnSortChange}
        currentSortBy="createdAt"
        currentSortOrder="desc"
      />
    );

    // Click sort button to open dropdown
    const sortButton = screen.getByText(/Sort by:/);
    fireEvent.click(sortButton);

    // Should show sort options in dropdown (use getAllByText and find dropdown options)
    const durationOptions = screen.getAllByText('Duration');
    expect(durationOptions.length).toBeGreaterThanOrEqual(2); // header + dropdown

    // Find and click the dropdown option (the one in a button inside the dropdown)
    const dropdownButtons = document.querySelectorAll('.absolute button');
    const durationButton = Array.from(dropdownButtons).find(btn => btn.textContent?.includes('Duration'));
    expect(durationButton).toBeTruthy();
    fireEvent.click(durationButton!);
    expect(mockOnSortChange).toHaveBeenCalledWith('duration', 'desc');
  });

  it('handles column header click for sorting', () => {
    render(
      <CallList
        calls={mockCalls}
        pagination={mockPagination}
        onPageChange={mockOnPageChange}
        onSortChange={mockOnSortChange}
        currentSortBy="createdAt"
        currentSortOrder="desc"
      />
    );

    // Click on Duration header (find the th element)
    const durationHeader = screen.getByRole('columnheader', { name: /Duration/ });
    fireEvent.click(durationHeader);
    expect(mockOnSortChange).toHaveBeenCalledWith('duration', 'desc');
  });

  it('toggles sort order when clicking same column', () => {
    render(
      <CallList
        calls={mockCalls}
        pagination={mockPagination}
        onPageChange={mockOnPageChange}
        onSortChange={mockOnSortChange}
        currentSortBy="duration"
        currentSortOrder="desc"
      />
    );

    // Open dropdown and click on Duration (already selected)
    const sortButton = screen.getByText(/Sort by:/);
    fireEvent.click(sortButton);

    // Find and click the dropdown option
    const dropdownButtons = document.querySelectorAll('.absolute button');
    const durationButton = Array.from(dropdownButtons).find(btn => btn.textContent?.includes('Duration'));
    fireEvent.click(durationButton!);
    expect(mockOnSortChange).toHaveBeenCalledWith('duration', 'asc');
  });

  it('formats phone numbers correctly', () => {
    render(
      <CallList
        calls={mockCalls}
        pagination={mockPagination}
        onPageChange={mockOnPageChange}
      />
    );

    // +15551234567 should be formatted as (555) 123-4567
    expect(screen.getByText('(555) 123-4567')).toBeInTheDocument();
    expect(screen.getByText('(555) 123-4568')).toBeInTheDocument();
  });

  it('shows correct page numbers in pagination', () => {
    render(
      <CallList
        calls={mockCalls}
        pagination={{ ...mockPagination, page: 2, hasPrev: true }}
        onPageChange={mockOnPageChange}
      />
    );

    // Should show page 1, 2, 3
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
  });

  it('handles page number click', () => {
    render(
      <CallList
        calls={mockCalls}
        pagination={mockPagination}
        onPageChange={mockOnPageChange}
      />
    );

    // Click page 2
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(mockOnPageChange).toHaveBeenCalledWith(2);
  });
});

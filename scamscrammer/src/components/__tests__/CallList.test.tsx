/**
 * CallList Component Tests
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CallList from '../CallList';
import type { CallListItem, PaginationInfo, CallListResponse } from '@/types';
import { CallStatus } from '@prisma/client';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

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
    isPublic: false,
    isFeatured: false,
    persona: 'earl',
    title: null,
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
    isPublic: false,
    isFeatured: false,
    persona: 'gladys',
    title: null,
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

const createMockResponse = (
  calls: CallListItem[] = mockCalls,
  pagination: PaginationInfo = mockPagination
): CallListResponse => ({
  calls,
  pagination,
});

describe('CallList Component', () => {
  const mockOnCallClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('with initial data', () => {
    // The component fetches on mount due to useEffect, so we need to mock fetch
    // for all tests with initialCalls to prevent errors
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockResponse(),
      });
    });

    it('renders calls in a table', async () => {
      await act(async () => {
        render(
          <CallList
            initialCalls={mockCalls}
            initialPagination={mockPagination}
            onCallClick={mockOnCallClick}
          />
        );
      });

      // Check table headers - these appear immediately even during loading
      expect(screen.getByText(/^Date/)).toBeInTheDocument();
      expect(screen.getByText('From')).toBeInTheDocument();

      // Wait for data to appear after fetch completes
      await waitFor(() => {
        // Check call data - duration 5:00 confirms data loaded
        expect(screen.getByText('5:00')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Now check other elements that should be visible
      // Status appears in both header/filter and in table as badge
      expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/^Duration/)).toBeInTheDocument();
      expect(screen.getByText(/^Rating/)).toBeInTheDocument();
      expect(screen.getByText('Segments')).toBeInTheDocument();

      // Check call data - status shown in title case
      // "Completed" appears both as status badge and filter option
      expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
      // "In Progress" appears both as status badge and filter option
      expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1);
      // Segments count
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('formats phone numbers correctly', async () => {
      await act(async () => {
        render(
          <CallList
            initialCalls={mockCalls}
            initialPagination={mockPagination}
          />
        );
      });

      // +15551234567 should be formatted as +1 (555) 123-4567
      await waitFor(() => {
        expect(screen.getByText('+1 (555) 123-4567')).toBeInTheDocument();
        expect(screen.getByText('+1 (555) 123-4568')).toBeInTheDocument();
      });
    });

    it('formats duration correctly', async () => {
      await act(async () => {
        render(
          <CallList
            initialCalls={mockCalls}
            initialPagination={mockPagination}
          />
        );
      });

      await waitFor(() => {
        // 300 seconds = 5:00
        expect(screen.getByText('5:00')).toBeInTheDocument();
        // null duration should show "-"
        const dashElements = screen.getAllByText('-');
        expect(dashElements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('displays rating stars correctly', async () => {
      await act(async () => {
        render(
          <CallList
            initialCalls={mockCalls}
            initialPagination={mockPagination}
          />
        );
      });

      await waitFor(() => {
        // Should render star containers
        const starContainers = document.querySelectorAll('.flex.gap-0\\.5');
        expect(starContainers.length).toBeGreaterThan(0);
      });
    });

    it('handles row click', async () => {
      await act(async () => {
        render(
          <CallList
            initialCalls={mockCalls}
            initialPagination={mockPagination}
            onCallClick={mockOnCallClick}
          />
        );
      });

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        expect(rows.length).toBeGreaterThan(1);
      });

      // Click on a row
      const rows = screen.getAllByRole('row');
      // First row is header, second row is first data row
      fireEvent.click(rows[1]);
      expect(mockOnCallClick).toHaveBeenCalledWith(mockCalls[0]);
    });

    it('shows pagination controls', async () => {
      await act(async () => {
        render(
          <CallList
            initialCalls={mockCalls}
            initialPagination={mockPagination}
          />
        );
      });

      await waitFor(() => {
        // Check pagination info
        expect(screen.getByText(/Showing/)).toBeInTheDocument();
        expect(screen.getByText('Previous')).toBeInTheDocument();
        expect(screen.getByText('Next')).toBeInTheDocument();
        expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
      });
    });

    it('disables previous button on first page', async () => {
      await act(async () => {
        render(
          <CallList
            initialCalls={mockCalls}
            initialPagination={mockPagination}
          />
        );
      });

      await waitFor(() => {
        const prevButton = screen.getByText('Previous');
        expect(prevButton).toBeDisabled();
      });
    });

    it('enables next button when hasNext is true', async () => {
      await act(async () => {
        render(
          <CallList
            initialCalls={mockCalls}
            initialPagination={mockPagination}
          />
        );
      });

      await waitFor(() => {
        const nextButton = screen.getByText('Next');
        expect(nextButton).not.toBeDisabled();
      });
    });

    it('renders filter controls', async () => {
      await act(async () => {
        render(
          <CallList
            initialCalls={mockCalls}
            initialPagination={mockPagination}
          />
        );
      });

      // Check filter labels - these are always visible
      expect(screen.getByText('Search')).toBeInTheDocument();
      expect(screen.getByText('Min Rating')).toBeInTheDocument();
      expect(screen.getByText('Apply')).toBeInTheDocument();
    });

    it('has status filter dropdown with all statuses', async () => {
      await act(async () => {
        render(
          <CallList
            initialCalls={mockCalls}
            initialPagination={mockPagination}
          />
        );
      });

      // Check options exist - these are always visible
      expect(screen.getByRole('option', { name: 'All Statuses' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Ringing' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Failed' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'No Answer' })).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no calls with no filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockResponse([], { ...mockPagination, total: 0, totalPages: 0 }),
      });

      await act(async () => {
        render(<CallList />);
      });

      await waitFor(() => {
        expect(screen.getByText('No calls found')).toBeInTheDocument();
      });

      expect(screen.getByText('Calls will appear here once they are received')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading spinner when fetching data', async () => {
      // Mock a pending fetch that never resolves
      mockFetch.mockImplementationOnce(() => new Promise(() => {}));

      render(<CallList />);

      // Check for loading spinner - should appear immediately since no initial data
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await act(async () => {
        render(<CallList />);
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch calls')).toBeInTheDocument();
      });
    });
  });

  describe('filters and actions', () => {
    it('triggers fetch when Apply button is clicked', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockResponse(),
      });

      await act(async () => {
        render(
          <CallList
            initialCalls={mockCalls}
            initialPagination={mockPagination}
          />
        );
      });

      // Wait for initial load to complete
      await waitFor(() => {
        expect(screen.getByText('Apply')).toBeInTheDocument();
      });

      mockFetch.mockClear();

      // Click Apply button
      await act(async () => {
        fireEvent.click(screen.getByText('Apply'));
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    it('includes filter params in fetch request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockResponse(),
      });

      await act(async () => {
        render(
          <CallList
            initialCalls={mockCalls}
            initialPagination={mockPagination}
          />
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Apply')).toBeInTheDocument();
      });

      // Find status select by looking for the select element with "All Statuses" option
      const statusSelect = screen.getAllByRole('combobox')[0];

      mockFetch.mockClear();

      await act(async () => {
        fireEvent.change(statusSelect, { target: { value: 'COMPLETED' } });
        fireEvent.click(screen.getByText('Apply'));
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('status=COMPLETED')
        );
      });
    });
  });

  describe('sorting', () => {
    it('sorts by duration when clicking Duration column header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockResponse(),
      });

      await act(async () => {
        render(
          <CallList
            initialCalls={mockCalls}
            initialPagination={mockPagination}
          />
        );
      });

      // Wait for data to be visible
      await waitFor(() => {
        expect(screen.getByText(/^Duration/)).toBeInTheDocument();
      });

      mockFetch.mockClear();

      // Click on Duration header to change sort field
      await act(async () => {
        fireEvent.click(screen.getByText(/^Duration/));
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('sortBy=duration')
        );
      });
    });

    it('changes sort when clicking column header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockResponse(),
      });

      await act(async () => {
        render(
          <CallList
            initialCalls={mockCalls}
            initialPagination={mockPagination}
          />
        );
      });

      // Wait for data to be visible
      await waitFor(() => {
        expect(screen.getByText(/^Rating/)).toBeInTheDocument();
      });

      mockFetch.mockClear();

      // Click Rating header to change sort field
      const ratingHeader = screen.getByText(/^Rating/);

      await act(async () => {
        fireEvent.click(ratingHeader);
      });

      // Should trigger fetch with new sort field
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('sortBy=rating')
        );
      });
    });
  });

  describe('pagination', () => {
    it('fetches next page when Next button is clicked', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockResponse(mockCalls, mockPagination),
      });

      await act(async () => {
        render(
          <CallList
            initialCalls={mockCalls}
            initialPagination={mockPagination}
          />
        );
      });

      // Wait for Next button to appear
      await waitFor(() => {
        expect(screen.getByText('Next')).toBeInTheDocument();
      });

      mockFetch.mockClear();

      await act(async () => {
        fireEvent.click(screen.getByText('Next'));
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('page=2')
        );
      });
    });

    it('fetches previous page when Previous button is clicked', async () => {
      const page2Pagination = { ...mockPagination, page: 2, hasPrev: true };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockResponse(mockCalls, page2Pagination),
      });

      await act(async () => {
        render(
          <CallList
            initialCalls={mockCalls}
            initialPagination={page2Pagination}
          />
        );
      });

      // Wait for pagination to render
      await waitFor(() => {
        expect(screen.getByText('Previous')).toBeInTheDocument();
      });

      const prevButton = screen.getByText('Previous');
      expect(prevButton).not.toBeDisabled();

      mockFetch.mockClear();

      await act(async () => {
        fireEvent.click(prevButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('page=1')
        );
      });
    });
  });

  describe('search', () => {
    it('triggers fetch when Enter is pressed in search field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockResponse(),
      });

      await act(async () => {
        render(
          <CallList
            initialCalls={mockCalls}
            initialPagination={mockPagination}
          />
        );
      });

      // Wait for search input to appear
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Phone number or notes...')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Phone number or notes...');

      mockFetch.mockClear();

      await act(async () => {
        fireEvent.change(searchInput, { target: { value: '555' } });
        fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('search=555')
        );
      });
    });
  });
});

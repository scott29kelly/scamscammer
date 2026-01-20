'use client';

import { useRouter } from 'next/navigation';
import CallList from '@/components/CallList';
import type { CallListItem } from '@/types';

export default function CallsPage() {
  const router = useRouter();

  const handleCallClick = (call: CallListItem) => {
    router.push(`/calls/${call.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Call History</h1>
          <p className="text-gray-400">
            Browse and manage all recorded scam calls. Click a row to view details.
          </p>
        </div>

        {/* Call List Component */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <CallList onCallClick={handleCallClick} />
        </div>
      </div>
    </div>
  );
}

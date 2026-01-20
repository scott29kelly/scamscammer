/**
 * Individual Call Detail Page
 *
 * Shows details for a single call including audio player and transcript.
 * Implementation will be added in a subsequent task.
 */

interface CallDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CallDetailPage({ params }: CallDetailPageProps) {
  const { id } = await params;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Call Details</h1>
      <p className="text-muted-foreground">
        Call ID: {id}
      </p>
      <p className="text-muted-foreground mt-2">
        Call detail view will be implemented in a future task.
      </p>
    </div>
  );
}

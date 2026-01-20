/**
 * ScamScrammer Landing/Dashboard Page
 *
 * Main entry point showing stats and recent activity.
 * Full implementation will be added in a subsequent task.
 */

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">ScamScrammer</h1>
          <nav className="flex gap-4">
            <a
              href="/"
              className="text-foreground hover:text-primary transition-colors"
            >
              Dashboard
            </a>
            <a
              href="/calls"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              Call History
            </a>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Welcome to ScamScrammer</h2>
          <p className="text-muted-foreground text-lg">
            AI-powered scam call interception that wastes scammers&apos; time so
            you don&apos;t have to.
          </p>
        </div>

        {/* Stats Cards Placeholder */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              Total Calls
            </h3>
            <p className="text-3xl font-bold text-card-foreground">0</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              Time Wasted
            </h3>
            <p className="text-3xl font-bold text-card-foreground">0:00:00</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              Avg Duration
            </h3>
            <p className="text-3xl font-bold text-card-foreground">0:00</p>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4 text-card-foreground">
            How It Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="w-10 h-10 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-3 font-bold">
                1
              </div>
              <h4 className="font-medium mb-1">Incoming Call</h4>
              <p className="text-muted-foreground text-sm">
                Scam call comes in and is routed to our AI system via Twilio.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-3 font-bold">
                2
              </div>
              <h4 className="font-medium mb-1">Earl Answers</h4>
              <p className="text-muted-foreground text-sm">
                Our AI persona &quot;Earl&quot; answers as a confused,
                talkative elderly gentleman.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-3 font-bold">
                3
              </div>
              <h4 className="font-medium mb-1">Time Wasted</h4>
              <p className="text-muted-foreground text-sm">
                Earl keeps scammers on the line with stories, questions, and
                endless tangents.
              </p>
            </div>
          </div>
        </div>

        {/* Recent Calls Placeholder */}
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4">Recent Calls</h3>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-muted-foreground text-center py-8">
              No calls recorded yet. Once scammers start calling, their
              conversations will appear here.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

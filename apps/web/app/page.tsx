import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, #22d3ee 0, transparent 40%), radial-gradient(circle at 80% 70%, #f59e0b 0, transparent 40%)",
        }}
      />
      <header className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-[--color-border]">
        <Link href="/" className="flex items-center gap-2 font-mono tracking-tight">
          <span className="inline-block size-2 rounded-full bg-[--color-accent] live-dot" />
          <span className="text-lg">FLIGHT_TRACKER</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-[--color-muted]">
          <Link href="/map" className="hover:text-[--color-fg]">Live Map</Link>
          <SignedIn>
            <Link href="/favorites" className="hover:text-[--color-fg]">Favorites</Link>
            <Link href="/alerts" className="hover:text-[--color-fg]">Alerts</Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="rounded-md border border-[--color-border] bg-[--color-panel] px-4 py-1.5 text-sm text-[--color-fg] hover:border-[--color-accent] hover:text-[--color-accent] transition">
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
        </nav>
      </header>

      <section className="relative z-10 mx-auto max-w-5xl px-8 pt-24 pb-16">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[--color-muted] mb-6">
          Open ADS-B · OpenSky Network · Live
        </p>
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05]">
          Every plane in the sky,<br />
          <span className="text-[--color-accent]">right now.</span>
        </h1>
        <p className="mt-8 max-w-2xl text-lg text-[--color-muted] leading-relaxed">
          A live global flight tracker. Moving markers stream in from OpenSky
          Network, pushed through Supabase Realtime with no page refresh.
          Filter by region, favorite callsigns and airlines, and set altitude
          or geofence alerts.
        </p>
        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/map"
            className="inline-flex items-center gap-2 rounded-md bg-[--color-accent] px-6 py-3 text-sm font-medium text-black hover:bg-cyan-300 transition"
          >
            Open live map →
          </Link>
          <Link
            href="https://github.com/superjwu/flight-tracker"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-md border border-[--color-border] bg-[--color-panel] px-6 py-3 text-sm font-medium hover:border-[--color-accent] hover:text-[--color-accent] transition"
          >
            View source
          </Link>
        </div>

        <dl className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            ["~20k", "planes tracked worldwide"],
            ["10s", "poll interval from OpenSky"],
            ["<1s", "realtime push latency"],
            ["∞", "history — kept 1h for trails"],
          ].map(([stat, label]) => (
            <div key={label} className="rounded-lg border border-[--color-border] bg-[--color-panel] p-5">
              <dt className="font-mono text-2xl text-[--color-accent]">{stat}</dt>
              <dd className="mt-1 text-sm text-[--color-muted]">{label}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-24 grid md:grid-cols-3 gap-6">
          {[
            {
              title: "Live map",
              body: "MapLibre GL, viewport-scoped realtime. Markers rotate by heading, color by altitude.",
            },
            {
              title: "Personalize",
              body: "Favorite callsigns, favorite airlines, save bbox views for one-click recall.",
            },
            {
              title: "Alert rules",
              body: "Notify when a flight enters a region, leaves it, or crosses an altitude threshold.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border border-[--color-border] bg-[--color-panel] p-6">
              <h3 className="font-mono text-sm uppercase tracking-wider text-[--color-accent]">
                {f.title}
              </h3>
              <p className="mt-3 text-sm text-[--color-muted] leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-[--color-border] px-8 py-6 text-xs text-[--color-muted]">
        Data © OpenSky Network · Map © OpenFreeMap · Built with Next.js, Supabase, Railway.
      </footer>
    </main>
  );
}

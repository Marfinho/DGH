"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="py-6">
      <div className="mb-5 flex items-center gap-3"><span className="h-9 w-2.5 shrink-0 bg-poster" aria-hidden /><h1>Das hat leider nicht geklappt</h1></div>
      <p className="mb-4 text-lg">Es ist ein Fehler aufgetreten. Deine Eingaben sind nicht verloren gegangen, wenn du es noch einmal versuchst. Bleibt das Problem bestehen, sag bitte dem Orga-Team Bescheid.</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={reset} className="btn">Nochmal versuchen</button>
        <a href="/" className="btn-light">Zur Startseite</a>
      </div>
    </div>
  );
}

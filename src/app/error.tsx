"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="not-found">
      <h1>Let’s try that again.</h1>
      <p>
        This page couldn’t load. Try again, or return to your painting table.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
      <a className="text-button" href="/saved">Return to My table</a>
    </main>
  );
}

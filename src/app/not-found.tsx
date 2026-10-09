import Link from "next/link";
export default function NotFound() {
  return (
    <main className="not-found">
      <span className="eyebrow">A little off the palette</span>
      <h1>That guide isn’t here.</h1>
      <p>Find a painting study from our current collection.</p>
      <Link className="button" href="/">
        Back to the studio
      </Link>
    </main>
  );
}

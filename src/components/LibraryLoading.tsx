/** Static placeholders preserve the destination's hierarchy without shimmer. */
export function LibraryLoading({ title }: { title: string }) {
  return <section className="library-loading" role="status" aria-label={`Opening ${title.toLowerCase()}`}><h1>{title}</h1><div className="library-loading-search" aria-hidden="true" /><div className="library-loading-grid" aria-hidden="true">{[0, 1, 2, 3].map(id => <div key={id} />)}</div></section>;
}

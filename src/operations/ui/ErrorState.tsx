export function ErrorState({ onRefresh }: { onRefresh: () => void }) { return <div role="alert"><p>Operations data is unavailable.</p><button onClick={onRefresh}>Refresh</button></div>; }

import styles from "./operations.module.css";
export function Header({ onRefresh }: { onRefresh: () => void }) { return <header><div><p className={styles.eyebrow}>Operations visibility</p><h1>Carrier Sales Operations</h1></div><strong>Demo/Mock</strong><button onClick={onRefresh}>Refresh</button><small>Last updated: fetch time (UTC)</small></header>; }

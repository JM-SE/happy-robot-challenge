import { label, status } from "../model/status"; import styles from "./operations.module.css";
export function StatusBadge({ value }: { value?: string }) { const state = status(value); return <span className={`${styles.status} ${styles[state]}`}><span aria-hidden="true">●</span> {label(value)}</span>; }

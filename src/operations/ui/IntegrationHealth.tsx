import { health } from "../model/config"; import { StatusBadge } from "./StatusBadge";
export function IntegrationHealth() { return <section><h2>Integration health</h2>{health.map((item) => <p key={item.label}><StatusBadge value={item.state} /> <b>{item.label}</b>: {item.detail}</p>)}</section>; }

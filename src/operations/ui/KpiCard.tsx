export function KpiCard({ label, value }: { label: string; value: string | number }) { return <article><small>{label}</small><b>{value}</b></article>; }

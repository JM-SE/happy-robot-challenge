export const date = (value?: string) => { if (!value) return "Unavailable"; const parsed = Date.parse(value); return Number.isNaN(parsed) ? "Unavailable" : new Date(parsed).toISOString().replace("T", " ").replace(".000Z", " UTC"); };
export const rate = (value?: number) => value === undefined || !Number.isFinite(value) ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: 2 });

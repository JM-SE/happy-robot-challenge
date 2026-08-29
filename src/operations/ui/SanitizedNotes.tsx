export function SanitizedNotes({ notes }: { notes?: string }) { return notes ? <details><summary>Sanitized notes</summary><p>{notes}</p></details> : null; }

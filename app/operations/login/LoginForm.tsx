"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../../src/operations/ui/operations.module.css";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(false);
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/operations/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ secret: form.get("secret") }),
      });
      if (!response.ok) throw new Error("login failed");
      router.push("/operations");
    } catch {
      setBusy(false);
      setError(true);
    }
  }
  return <main className={`${styles.shell} ${styles.login}`}><section aria-labelledby="login-title"><p className={styles.eyebrow}>Protected workspace</p><h1 id="login-title">Operations sign in</h1><p>Use the configured Operations UI session to continue.</p><form onSubmit={submit}><label htmlFor="operations-secret">UI session secret</label><input id="operations-secret" name="secret" type="password" autoComplete="current-password" required maxLength={256} /><button type="submit" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>{error ? <p role="alert">Unable to sign in. Check the supplied value and try again.</p> : null}</form></section></main>;
}

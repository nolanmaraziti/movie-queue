"use client";

import { useState } from "react";
import { clearLocalQueue, loadLocalQueue, STARTERS } from "@/lib/queue";
import TmdbCredit from "./TmdbCredit";

type Mode = "login" | "signup";

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    // Bring along any movies saved in this browser from before accounts existed.
    // New accounts with nothing saved start with a few example picks.
    const local = loadLocalQueue();
    const queue = local ?? (mode === "signup" ? STARTERS : []);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, queue }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That didn't work. Try again.");
      clearLocalQueue();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
      setBusy(false);
    }
  }

  function switchTo(m: Mode) {
    setMode(m);
    setError("");
  }

  return (
    <div className="app">
      <header>
        <div className="top">
          <h1>Movie<br />Queue</h1>
        </div>
        <div className="sub">
          <span>Your next ten movies, in order.</span>
        </div>
      </header>
      <main>
        <form className="auth" onSubmit={submit}>
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => switchTo("login")}>Log in</button>
            <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => switchTo("signup")}>Sign up</button>
          </div>
          <label>
            <span className="label">Username</span>
            <input
              className="field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              minLength={3}
              maxLength={20}
              pattern="[A-Za-z0-9_.]+"
              title="Letters, numbers, dots or underscores"
            />
          </label>
          <label>
            <span className="label">Password</span>
            <input
              className="field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={mode === "signup" ? 8 : undefined}
            />
          </label>
          {mode === "signup" && <div className="hint">3 to 20 letters, numbers, dots or underscores. Password at least 8 characters.</div>}
          {error && <div className="full" role="alert">{error}</div>}
          <button className="add big" disabled={busy}>
            {busy ? "One moment…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </main>
      <TmdbCredit />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { type Answers, answerLabels, QUESTIONS } from "@/lib/questions";
import { XIcon } from "./icons";

// "Help me pick": up to eight quick questions, one at a time. You can jump to the movies whenever you like.
export default function PickQuestions() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const advance = useRef<ReturnType<typeof setTimeout>>(undefined);

  const q = QUESTIONS[step];
  const last = step === QUESTIONS.length - 1;
  const value = answers[q.key];
  const picked = (v: string) => (Array.isArray(value) ? value.includes(v) : value === v);

  function choose(v: string) {
    if (q.multi) {
      const list = (value as string[] | undefined) ?? [];
      setAnswers({ ...answers, [q.key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] });
    } else {
      setAnswers({ ...answers, [q.key]: value === v ? undefined : v });
      // One-choice questions move on by themselves after a moment.
      clearTimeout(advance.current);
      if (value !== v && !last) advance.current = setTimeout(() => setStep((s) => Math.min(s + 1, QUESTIONS.length - 1)), 280);
    }
  }

  async function showMovies() {
    clearTimeout(advance.current);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/pick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (res.status === 401) return window.location.reload();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't find movies. Try again.");
      router.push(`/pick/${data.token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't find movies. Try again.");
      setBusy(false);
    }
  }

  const sofar = answerLabels(answers);

  if (busy) {
    return (
      <div className="app ask">
        <div className="empty">
          <strong>Finding movies…</strong>
          <span>Looking for ones that fit your answers.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app ask">
      <div className="ask-top">
        <Link className="round" href="/" aria-label="Close"><XIcon size={20} /></Link>
        <span>Question {step + 1} of {QUESTIONS.length}</span>
        {last ? <span /> : <button className="link plain" onClick={() => setStep(step + 1)}>Skip</button>}
      </div>
      <div className="steps" aria-hidden="true">
        {QUESTIONS.map((_, i) => <i key={i} className={i <= step ? "on" : ""} />)}
      </div>
      {sofar.length > 0 && (
        <div className="chips sofar">
          {sofar.map((s) => <span key={s} className="chipbtn static">{s}</span>)}
        </div>
      )}
      <h1>{q.title}</h1>
      <p className="tip">{q.hint}</p>
      <div className="choices" role="group" aria-label={q.title}>
        {q.choices.map((c) => (
          <button key={c.value} aria-pressed={picked(c.value)} onClick={() => choose(c.value)}>{c.label}</button>
        ))}
      </div>
      {error && <div className="full" role="alert">{error}</div>}
      <div className="ask-actions">
        {step > 0 && <button className="pill ghost" onClick={() => setStep(step - 1)}>Back</button>}
        {last ? (
          <button className="pill hot big" onClick={showMovies}>Show me movies</button>
        ) : (
          <button className="pill big" onClick={() => setStep(step + 1)}>Next question</button>
        )}
      </div>
      {!last && <button className="link plain enough" onClick={showMovies}>That&apos;s enough, show me movies</button>}
    </div>
  );
}

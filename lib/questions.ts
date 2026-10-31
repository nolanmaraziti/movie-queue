// "Help me pick": the questions, their choices, and what an answer means. Safe for server and browser.

export type Answers = {
  who?: string; // solo, partner, friends, family
  genres?: string[]; // TMDB genre ids, as text
  decades?: string[]; // new, 2010, 2000, 1990, 1980, 1970, old, any
  moods?: string[]; // fun, edge, think, cry, cozy
  length?: string; // 90, 120, any
  fame?: string; // known, gem, either
  rating?: string; // any, 7, 8
  language?: string; // en, any, other
};

export type Question = {
  key: keyof Answers;
  title: string;
  hint: string;
  multi: boolean;
  choices: { value: string; label: string }[];
};

export const QUESTIONS: Question[] = [
  {
    key: "who", title: "Who's watching?", hint: "Pick one.", multi: false,
    choices: [
      { value: "solo", label: "Just me" }, { value: "partner", label: "Date night" },
      { value: "friends", label: "With friends" }, { value: "family", label: "With family" },
    ],
  },
  {
    key: "genres", title: "What kind of movie?", hint: "Choose as many as you like.", multi: true,
    choices: [
      ["28", "Action"], ["35", "Comedy"], ["18", "Drama"], ["27", "Horror"], ["878", "Sci-fi"], ["10749", "Romance"],
      ["53", "Thriller"], ["16", "Animation"], ["12", "Adventure"], ["14", "Fantasy"], ["80", "Crime"],
      ["9648", "Mystery"], ["99", "Documentary"], ["10402", "Music"],
    ].map(([value, label]) => ({ value, label })),
  },
  {
    key: "decades", title: "Pick a decade", hint: "Choose as many as you like.", multi: true,
    choices: [
      ["new", "Newest"], ["2010", "2010s"], ["2000", "2000s"], ["1990", "1990s"],
      ["1980", "1980s"], ["1970", "1970s"], ["old", "Older"], ["any", "Surprise me"],
    ].map(([value, label]) => ({ value, label })),
  },
  {
    key: "moods", title: "What's the mood?", hint: "Choose as many as you like.", multi: true,
    choices: [
      ["fun", "Light and fun"], ["edge", "Edge of my seat"], ["think", "Make me think"],
      ["cry", "Make me cry"], ["cozy", "Cozy and easy"],
    ].map(([value, label]) => ({ value, label })),
  },
  {
    key: "length", title: "How long have you got?", hint: "Pick one.", multi: false,
    choices: [{ value: "90", label: "Under 90 minutes" }, { value: "120", label: "Under 2 hours" }, { value: "any", label: "Any length" }],
  },
  {
    key: "fame", title: "Well known or hidden gem?", hint: "Pick one.", multi: false,
    choices: [{ value: "known", label: "Crowd pleaser" }, { value: "gem", label: "Hidden gem" }, { value: "either", label: "Either" }],
  },
  {
    key: "rating", title: "How good does it need to be?", hint: "Going by TMDB's ratings.", multi: false,
    choices: [{ value: "any", label: "I'm easy" }, { value: "7", label: "Pretty good (7+)" }, { value: "8", label: "Great (8+)" }],
  },
  {
    key: "language", title: "Subtitles okay?", hint: "Pick one.", multi: false,
    choices: [{ value: "en", label: "English only" }, { value: "any", label: "Any language" }, { value: "other", label: "Something not in English" }],
  },
];

// The genres each mood leans towards.
export const MOOD_GENRES: Record<string, number[]> = {
  fun: [35, 16, 10751, 12],
  edge: [53, 27, 28, 80],
  think: [878, 9648, 99, 18],
  cry: [18, 10749],
  cozy: [35, 10749, 16, 10751, 14],
};

// The years each decade choice covers.
export const DECADES: Record<string, [number, number]> = {
  new: [2020, 2100], "2010": [2010, 2019], "2000": [2000, 2009], "1990": [1990, 1999],
  "1980": [1980, 1989], "1970": [1970, 1979], old: [1900, 1969],
};

// Keeps only answers that are real choices, so nothing odd gets saved.
export function cleanAnswers(raw: unknown): Answers {
  const a = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Answers = {};
  for (const q of QUESTIONS) {
    const allowed = new Set(q.choices.map((c) => c.value));
    const v = a[q.key];
    if (q.multi) {
      const list = Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.has(x)))] : [];
      if (list.length) (out[q.key] as string[]) = list;
    } else if (typeof v === "string" && allowed.has(v)) {
      (out[q.key] as string) = v;
    }
  }
  return out;
}

// Short labels for the answers given so far, like "Sci-fi" or "With friends".
export function answerLabels(a: Answers): string[] {
  const out: string[] = [];
  for (const q of QUESTIONS) {
    const v = a[q.key];
    const values = Array.isArray(v) ? v : v ? [v] : [];
    for (const val of values) {
      const label = q.choices.find((c) => c.value === val)?.label;
      if (label) out.push(label);
    }
  }
  return out;
}

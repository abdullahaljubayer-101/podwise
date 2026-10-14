export const MAX_TEXT = 60000,
  MAX_AUDIO = 20 * 1024 * 1024,
  MAX_DURATION = 1200;
export type Segment = {
  id: number;
  text: string;
  start: number | null;
  end: number | null;
};
export type Analysis = {
  summary: string;
  themes: string[];
  takeaways: { text: string; evidence: string; segmentId: number }[];
  chapters: {
    title: string;
    description: string;
    segmentId: number;
    evidence: string;
  }[];
  quiz: {
    question: string;
    options: string[];
    answer: number;
    explanation: string;
    evidence: string;
    segmentId: number;
  }[];
};
export function normalize(s: string) {
  return s.replace(/\s+/g, " ").trim();
}
export function parseTranscript(text: string): Segment[] {
  if (
    typeof text !== "string" ||
    text.trim().length < 100 ||
    text.length > MAX_TEXT
  )
    throw Error("Transcript must contain 100–60,000 characters.");
  const lines = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: Segment[] = [];
  let last = -1;
  for (const line of lines) {
    const m = line.match(
      /^\[?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]?\s*[-–:]?\s*(.*)$/,
    );
    let start: number | null = null;
    let content = line;
    if (m) {
      const h = Number(m[1] || 0),
        min = Number(m[2]),
        sec = Number(m[3]);
      if (sec > 59 || (m[1] && min > 59))
        throw Error("Transcript has an invalid timestamp.");
      start = h * 3600 + min * 60 + sec;
      if (start < last)
        throw Error("Transcript timestamps must be in chronological order.");
      last = start;
      content = m[4];
    }
    if (!content.trim()) continue;
    // Keep paragraphs bounded for source references without inventing time offsets.
    const parts: string[] = [];
    let remaining = content;
    while (remaining.length > 1200) {
      let cut = remaining.lastIndexOf(" ", 1200);
      if (cut < 600) cut = 1200;
      parts.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut).trimStart();
    }
    if (remaining) parts.push(remaining);
    parts.forEach((p, i) =>
      out.push({
        id: out.length,
        text: p.trim(),
        start: i === 0 ? start : null,
        end: null,
      }),
    );
  }
  if (!out.length) throw Error("No transcript content found.");
  return out;
}
export function parseAudioTranscript(
  raw: unknown,
  duration: number,
): Segment[] {
  const data = raw as { segments?: unknown[] };
  if (
    !data ||
    !Array.isArray(data.segments) ||
    !data.segments.length ||
    data.segments.length > 250
  )
    throw Error("Audio transcription did not return usable speech.");
  let last = -1;
  const out = data.segments.map((v, i) => {
    const s = v as { text?: unknown; start?: unknown; end?: unknown };
    if (typeof s.text !== "string" || !s.text.trim())
      throw Error("Invalid transcript segment.");
    let start = typeof s.start === "number" ? s.start : null;
    let end = typeof s.end === "number" ? s.end : null;
    if (
      start !== null &&
      (!Number.isFinite(start) ||
        start < 0 ||
        start > duration + 1 ||
        start < last)
    )
      start = null;
    if (
      end !== null &&
      (!Number.isFinite(end) ||
        end < 0 ||
        end > duration + 1 ||
        (start !== null && end < start))
    )
      end = null;
    if (start !== null) last = start;
    return { id: i, text: s.text.trim(), start, end };
  });
  const text = out.map((s) => s.text).join("\n");
  if (text.length < 100 || text.length > MAX_TEXT)
    throw Error("Audio speech is too short or too long for this demo.");
  return out;
}
function str(v: unknown, max = 5000): string {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    throw Error("AI output has a missing or oversized field.");
  return v.trim();
}
function list(v: unknown, min: number, max: number): unknown[] {
  if (!Array.isArray(v) || v.length < min || v.length > max)
    throw Error("AI output has an invalid list length.");
  return v;
}
function evidence(v: Record<string, unknown>, segments: Segment[]) {
  const id = v.segmentId;
  if (!Number.isInteger(id) || Number(id) < 0 || Number(id) >= segments.length)
    throw Error("AI output cites an unknown source segment.");
  const quote = str(v.evidence, 800);
  if (!normalize(segments[Number(id)].text).includes(normalize(quote)))
    throw Error("AI evidence does not match the transcript.");
  return { segmentId: Number(id), evidence: quote };
}
export function validateAnalysis(raw: unknown, segments: Segment[]): Analysis {
  const r = raw as Record<string, unknown>;
  if (!r || typeof r !== "object") throw Error("AI output is not an object.");
  const result: Analysis = {
    summary: str(r.summary),
    themes: list(r.themes, 1, 6).map((v) => str(v, 150)),
    takeaways: list(r.takeaways, 1, 6).map((v) => {
      const t = v as Record<string, unknown>;
      return { text: str(t.text, 1000), ...evidence(t, segments) };
    }),
    chapters: list(r.chapters, 1, 12).map((v) => {
      const c = v as Record<string, unknown>;
      return {
        title: str(c.title, 150),
        description: str(c.description, 1000),
        ...evidence(c, segments),
      };
    }),
    quiz: list(r.quiz, 3, 5).map((v) => {
      const q = v as Record<string, unknown>;
      const options = list(q.options, 4, 4).map((v) => str(v, 500));
      if (
        new Set(options.map(normalize)).size !== 4 ||
        !Number.isInteger(q.answer) ||
        Number(q.answer) < 0 ||
        Number(q.answer) > 3
      )
        throw Error("AI returned an invalid quiz answer.");
      return {
        question: str(q.question, 500),
        options,
        answer: Number(q.answer),
        explanation: str(q.explanation, 1000),
        ...evidence(q, segments),
      };
    }),
  };
  for (let i = 1; i < result.chapters.length; i++)
    if (result.chapters[i].segmentId < result.chapters[i - 1].segmentId)
      throw Error("AI chapters are not chronological.");
  return result;
}
export const analysisSchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    themes: { type: "ARRAY", items: { type: "STRING" } },
    takeaways: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          evidence: { type: "STRING" },
          segmentId: { type: "INTEGER" },
        },
        required: ["text", "evidence", "segmentId"],
      },
    },
    chapters: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: { type: "STRING" },
          evidence: { type: "STRING" },
          segmentId: { type: "INTEGER" },
        },
        required: ["title", "description", "evidence", "segmentId"],
      },
    },
    quiz: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          answer: { type: "INTEGER" },
          explanation: { type: "STRING" },
          evidence: { type: "STRING" },
          segmentId: { type: "INTEGER" },
        },
        required: [
          "question",
          "options",
          "answer",
          "explanation",
          "evidence",
          "segmentId",
        ],
      },
    },
  },
  required: ["summary", "themes", "takeaways", "chapters", "quiz"],
};
export const transcriptionSchema = {
  type: "OBJECT",
  properties: {
    segments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          start: { type: "NUMBER" },
          end: { type: "NUMBER" },
        },
        required: ["text", "start", "end"],
      },
    },
  },
  required: ["segments"],
};
export function safeError(err: unknown) {
  const message = err instanceof Error ? err.message : "Processing failed.";
  if (/returned 50[0234]/i.test(message))
    return "The AI provider is temporarily unavailable. Retry this saved stage in a moment.";
  if (/429|quota|rate.limit/i.test(message))
    return "The free AI quota is temporarily exhausted. Wait before retrying; no paid fallback is enabled.";
  if (/abort|timeout|timed out/i.test(message))
    return "Processing timed out. Try a shorter recording or retry this stage.";
  if (/401|403|API.key|permission/i.test(message))
    return "The AI service configuration needs attention. Please contact the project owner.";
  return message.slice(0, 300);
}

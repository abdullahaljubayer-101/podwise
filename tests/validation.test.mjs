import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTranscript,
  parseAudioTranscript,
  validateAnalysis,
  safeError,
} from "../supabase/functions/podwise-worker/core.ts";
const source =
  "Active recall means retrieving information from memory before checking the answer. Spaced practice means returning to material across separate sessions.";
const segments = parseTranscript(
  "[00:00] " +
    source +
    "\n[01:15] The learner closes the notes, retrieves three ideas, then checks mistakes against the source. A five-minute routine is easy to repeat.",
);
const result = {
  summary: "Retrieve, check and revisit.",
  themes: ["Learning"],
  takeaways: [
    {
      text: "Recall before checking.",
      evidence: "Active recall means retrieving information from memory",
      segmentId: 0,
    },
  ],
  chapters: [
    {
      title: "Active recall",
      description: "A retrieval practice.",
      evidence: "Active recall means retrieving information",
      segmentId: 0,
    },
  ],
  quiz: Array.from({ length: 3 }, () => ({
    question: "What does active recall involve?",
    options: [
      "Retrieving from memory",
      "Only rereading",
      "Never checking",
      "Ignoring errors",
    ],
    answer: 0,
    explanation:
      "The source defines it as retrieving information before checking.",
    evidence:
      "Active recall means retrieving information from memory before checking the answer.",
    segmentId: 0,
  })),
};
test("preserves supplied timestamps and does not invent missing ones", () => {
  assert.equal(segments[1].start, 75);
  assert.equal(parseTranscript(source)[0].start, null);
});
test("rejects too-short, oversized, invalid and backwards timestamp input", () => {
  for (const s of [
    "short",
    "a".repeat(60001),
    "[00:99] " + source,
    "[01:00] " + source + "\n[00:10] " + source,
  ])
    assert.throws(() => parseTranscript(s));
});
test("accepts grounded well-formed analysis", () =>
  assert.equal(validateAnalysis(result, segments).quiz[0].answer, 0));
test("rejects fabricated evidence and unknown segments", () => {
  assert.throws(() =>
    validateAnalysis(
      {
        ...result,
        takeaways: [
          {
            text: "Unsupported",
            segmentId: 0,
            evidence: "A fabricated quotation",
          },
        ],
      },
      segments,
    ),
  );
  assert.throws(() =>
    validateAnalysis(
      { ...result, chapters: [{ ...result.chapters[0], segmentId: 200 }] },
      segments,
    ),
  );
});
test("rejects duplicate quiz choices and invalid answer indexes", () => {
  assert.throws(() =>
    validateAnalysis(
      { ...result, quiz: result.quiz.map((q) => ({ ...q, answer: 4 })) },
      segments,
    ),
  );
  assert.throws(() =>
    validateAnalysis(
      {
        ...result,
        quiz: result.quiz.map((q) => ({
          ...q,
          options: ["same", "same", "b", "c"],
        })),
      },
      segments,
    ),
  );
});
test("clears invalid audio time offsets without inventing replacements", () => {
  const out = parseAudioTranscript(
    { segments: [{ text: source, start: 999, end: 1000 }] },
    60,
  );
  assert.equal(out[0].start, null);
  assert.equal(out[0].end, null);
});
test("explains quota and timeout failures safely", () => {
  assert.match(safeError(Error("AI service returned 429.")), /free AI quota/);
  assert.match(safeError(Error("timeout")), /shorter recording/);
});

test("long unbroken source text is preserved instead of silently truncated", () => {
  const t = "x".repeat(2800);
  assert.equal(
    parseTranscript(t)
      .map((s) => s.text)
      .join(""),
    t,
  );
});

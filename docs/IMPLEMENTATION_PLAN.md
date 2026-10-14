# Podwise implementation plan

## Goal
Deliver the Thealon AI Engineering Challenge as a focused, unauthenticated web application. No landing page, account system, pricing, or billing. Both reviewer and author can submit permitted recordings or transcripts.

## Acceptance checklist
1. Audio uploads (MP3/WAV/M4A, 20 MB, 20 minutes) and pasted transcripts (100–60,000 characters); validate on browser and server, disclose all restrictions.
2. Actual Gemini analysis: concise summary, themes, takeaways, chapters with evidence, and 3–5 comprehension questions with answers/explanations.
3. Transcript navigation and audio playback. Preserve supplied timestamps; identify AI-estimated audio offsets explicitly. Never synthesize timestamps for untimed text.
4. Revise overview or quiz only, reusing saved transcript and retaining other results. Save revision history.
5. Copy and export Markdown, JSON and printable notes.
6. Browser-local session capability for private job access without user accounts. No public database/storage policies. No provider credentials in browser source.
7. Explicit progress, errors, retry, and private session history. Handle quota exhaustion, provider errors, invalid audio, insufficient speech, malformed responses and expired jobs.
8. Public Vercel URL, complete GitHub source, README with provider comparison, architecture, debugging, limitations, cost, three prioritized next steps, and a real workflow demo recording.

## Architecture
Browser → Next.js API on Vercel → Supabase Postgres/private Storage → Supabase Edge Function → Gemini API.

Audio uploads go directly to Supabase using scoped signed upload tokens. API requests do not proxy large recordings. Next.js signs requests to the worker with the server-only service key; the worker validates the key before doing any work.

Jobs are processed in stages: queued → transcribing → awaiting_analysis → analyzing → completed (or failed). EdgeRuntime.waitUntil runs a bounded stage after the response. Postgres compare-and-set claims prevent duplicate processing. The UI invokes the next stage when necessary; a job that is awaiting analysis survives a closed tab and resumes when revisited. This is staged background processing, not an unlimited durable queue.

Free Supabase workers have a 150-second lifetime. Each provider call has a shorter timeout. Stuck stages become retryable; retries retain the transcript. No Inngest dependency is needed at the current limits. For unattended continuation and longer recordings, the next improvement is a database queue plus scheduled worker.

## Delivery order
Provision Free Supabase project and Gemini free-tier key; store credentials as Vercel secrets. Apply private schema and storage bucket, deploy worker. Replace frontend and implement API. Run validation tests/build. Push source, deploy publicly, test real transcript and audio paths, revisions, downloads, failures and mobile layouts. Capture an actual screen recording. Mark incomplete items honestly until verified.

## Provisioning decisions
The user created the Supabase database password and approved Gemini key creation and server-only secret storage. Services are provisioned. The production alias is public without changing preview deployment protection. Worker authentication uses the explicitly configured PODWISE_SERVER_KEY. The model is Gemini 3.5 Flash-Lite after availability, quota, latency, and evidence-validation checks.

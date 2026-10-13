# Podwise — AI Podcast Companion

A submission project for Thealon Animation Studios' **From Audio to Insight** AI Engineering Challenge. Helps listeners understand, navigate, and learn from podcast recordings or transcripts.

## Current status

**Frontend preview only.** Real AI integration, authentication, cloud storage, and background processing are not implemented yet. This README distinguishes working features from planned integrations. Pricing, billing, and cart features are excluded.

Preview: https://podwise-companion.abdullahaljubayer101.chatgpt.site

## Challenge requirements

| Requirement | Current implementation | Remaining work |
| --- | --- | --- |
| Provide content | Audio selection (MP3/WAV/M4A, max 25 MB), transcript input (50–100,000 characters) | Secure cloud upload, server validation, transcription |
| Episode overview | Clearly labeled example summary and takeaways | Generate from actual input with Gemini |
| Navigable chapters | Example chapters and timestamps | Use verified transcript offsets; omit unavailable timestamps |
| Interactive learning | Three-question demo quiz, scoring, explanations | Generate grounded questions and evidence |
| Meaningful revision | Shorter/simpler demo overview; other panels unchanged | Apply user instructions using source transcript |
| Usable result | Responsive UI, library search/filter, copy/download | Test live end-to-end AI workflow |

## Local setup

Requires Node.js 20+ and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Select **Continue with demo account** to explore.

```sh
npm run typecheck
npm run build
```

The current Next.js configuration exports static files to `out/`. For a server-route backend, remove `output: 'export'` and update hosting output settings before deploying.

## Architecture

Current: Next.js/React UI → browser-local demo state → example results. Local recordings stay in browser memory and can be played during the session. Transcript text and episode metadata persist in localStorage. Demo passwords are never saved or sent; demo auth is not access control.

Planned: Next.js on Vercel → Supabase Auth, private Storage and Postgres → bounded Supabase Edge Function processing → Gemini → persisted results and progress → UI. Keep the Gemini key only in server-side secret storage. Owner-based RLS policies must protect episode rows and audio access.

Supabase background tasks have worker lifetime limits; `waitUntil` does not make jobs unlimited or durable. Use staged jobs with recorded status and retries, and enforce short audio limits based on measured runtime. A queue plus worker can be added if a single stage cannot complete reliably.

## Research and approach comparison

| Option | Fit | Integration / limitations | Cost approach |
| --- | --- | --- | --- |
| Gemini audio understanding + structured text generation | One provider for audio analysis and episode outputs | JSON validation still needed; transcription errors and timestamp drift must be tested | Use only available free quota; stop on exhausted quota |
| OpenAI transcription + text generation | Separate speech-to-text and analysis stages | Additional API integration; can use supported transcription timestamps | Do not enable paid API usage for this zero-budget project |

Selection: Gemini is the intended provider because this project has a strict zero-budget constraint. Verify model availability and quota in the actual account before implementation; a free tier is not an unlimited service.

Official references influencing the design:
- [Gemini audio understanding](https://ai.google.dev/gemini-api/docs/audio): audio processing capabilities and formats.
- [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing): free-tier eligibility and usage constraints.
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output): schema-constrained responses; application validation remains necessary.
- [OpenAI speech-to-text](https://platform.openai.com/docs/guides/speech-to-text): alternative transcription workflow.
- [Supabase background tasks](https://supabase.com/docs/guides/functions/background-tasks): work can continue after an HTTP response, within execution limits.
- [Supabase function limits](https://supabase.com/docs/guides/functions/limits): processing must fit worker limits.
- [Vercel function limits](https://vercel.com/docs/functions/limitations): large recordings should upload directly to storage rather than through function request bodies.
- [OWASP API Security](https://owasp.org/www-project-api-security/): authorization, input validation and resource limits.

These are implementation references, not claims of completed provider benchmarks. Record observed quality, latency and failure behavior after integration.

## Reliability and responsible handling

Current output is illustrative, not generated from uploaded content. Do not treat it as factual episode analysis. Example timestamps are not aligned to a user's upload. Audio playback does not survive refresh; select the recording again. Browser-local history is neither encrypted nor isolated between demo accounts. Do not use sensitive or confidential material.

Planned safeguards: file/type/duration validation; strict output schemas; transcript evidence for quiz answers and key claims; verified timestamps; bounded requests, retries and quota errors; per-user authorization; private signed audio access; deletion/retention controls; cancellation-aware jobs. User content must be treated as data rather than trusted model instructions.

## Debugging and verification

Production compilation, TypeScript checks and static export passed for the original frontend. Browser/device visual checks and actual AI/API failure testing remain pending. After integrations, document one real issue or deliberately tested failure here, including the observed error, investigation, fix, retest and outcome. Do not claim a test was performed unless it was.

## Cost and maintenance

Use Supabase Free, Vercel Hobby and available Gemini free quota only. No paid plan, subscription or billing upgrade is authorized. Quota exhaustion should produce a clear message rather than incur charges. Track provider/model changes, review logs, retain lockfiles, and refresh dependencies deliberately.

## Three prioritized next steps

1. **Real grounded AI workflow:** replace examples with source-based analysis, validate output and revisions, and test on permitted recordings. This is the core missing challenge requirement.
2. **Reliable private processing:** connect auth, ownership policies, direct uploads, saved job stages and recovery so results are private and survive refresh.
3. **Submission verification:** test real inputs, malformed outputs, rate limits, mobile layouts and the public URL; record a short demo and complete engineering notes.

## Submission checklist

- [x] Responsive frontend and demo workflow.
- [x] Source setup instructions and explicit limitations.
- [ ] Real AI model/API integrated and tested.
- [ ] Actual source-grounded summaries, chapters, quizzes and revision.
- [ ] Public repository and reviewer-accessible deployment verified.
- [ ] Demo recording showing input → results → revision.
- [ ] Evidence-backed comparison and actual debugging example finalized.
- [ ] Final secrets scan and end-to-end checks.

## Secrets

Never commit `.env.local`, API keys, service-role keys, database passwords, or deployment tokens. Public Supabase publishable configuration may be placed in browser env variables only after RLS is implemented; privileged keys must remain server-only.

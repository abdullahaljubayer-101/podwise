# Podwise verification — 14 October 2026

## Automated checks
Production Next.js build and TypeScript checking passed. All 22 tests passed: 8 input/output validation tests and 14 mocked API tests. Coverage includes chronology, source preservation, evidence matching, quiz integrity, capabilities, CSRF rejection, quotas, signed uploads/playback, retry limits, targeted revision dispatch, and deletion ownership.

## Actual deployed workflow
- Public production page and configured API reachable without a Vercel account.
- Real Gemini 3.5 Flash-Lite analysis of the original 1,401-character sample transcript, including summary, themes, takeaways, chapters, and quiz. No placeholder output.
- Overview shortening: summary changed from 364 to 152 characters; downloaded JSON proved the quiz, chapters and transcript remained exactly equal. One revision entry was saved.
- Real quiz revision with practical questions: API test proved summary, takeaways and chapters remained equal, while quiz changed. The disposable test episode was deleted and subsequent access returned 404.
- Original synthesized 75.82-second WAV uploaded to private Storage, transcribed, analyzed, and reopened through a signed playback URL. Audio loaded with readyState 4 and no media error. Chapter click sought to approximately 31 seconds and started playback.
- Quiz scoring showed 4/4 with explanations and evidence. Source navigation highlighted the correct transcript segment. Browser history search returned the intended episode.
- Markdown and JSON downloads succeeded and contained real episode data.
- Six live API checks passed: configured readiness, missing session, short transcript, oversized audio, cross-site mutation, and cross-session read rejection.
- Unauthenticated worker invocation rejected with 403. Tables have RLS, no anon/authenticated SELECT permission, and server-only access. Audio bucket is private. Security advisor warnings on the default privileged RLS trigger were corrected; remaining no-policy notices are intentional for server-only tables.

## Responsive verification
The responsive preview embeds the actual deployed app at 375, 768 and 1280 px outer widths. The effective width can be 15 px smaller when a scrollbar is present. Checks found no horizontal document overflow. Mobile menu, history, episode navigation and quiz scoring passed (4/4). Tablet history and audio-episode view passed. Desktop core workflow was exercised directly. These are browser viewport tests, not tests on physical iOS/Android/tablet hardware.

## Demo
[44-second screen recording](https://podwise-six.vercel.app/podwise-demo.mp4). Actual browser frames show the permitted sample input, live analysis, chapters, quiz, shorter overview request, updated output and revision trail. Captured at a low frame rate and assembled with gaps between capture segments trimmed. No simulated AI result or artificial success state.

## Practical limits
Provider free quotas, overload and outages still affect availability. Network/5xx failures receive one retry within a 110-second stage deadline; quota errors never enable paid fallback. Audio timestamps are generative estimates, not exact alignment. Exact quote checks do not prove every generated interpretation is correct. Access expires after 24 hours, but stored records need owner maintenance until automated retention is added. Closing the tab may leave a saved transcript awaiting analysis until revisited.

Native clipboard content readback and the browser print dialog could not be independently verified through this browser interface. Their controls use standard browser APIs and expose download/error alternatives; Markdown and JSON exports were verified. Maximum-limit 20-minute/20-MB files, all language/accent combinations, and adversarial semantic accuracy were not benchmarked.

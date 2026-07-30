All 9 API keys are saved as server-side secrets, and your robot logo is now the nav logo.

Here is how I propose to build the real product. It's large, so I'd deliver it in phases — each phase leaves the app working.

## Phase 1 — Backend foundation
- Enable Lovable Cloud (database, auth, file storage, server runtime).
- Email/password + Google sign-in, `/auth` page, protected app area.
- Tables: `profiles`, `user_roles` (admin/user, separate table for security), `generations` (prompt, platform, status, step, output URLs, error), `generation_events` (log per step), `social_connections` (OAuth tokens, service-role only), `provider_status` (last health check per provider).
- Storage buckets for uploaded scripts and finished videos.

## Phase 2 — Provider layer + API Settings page
- A server-side provider registry: each provider is one module declaring its env var, a `healthCheck()`, and its capability (llm / video / tts / image / agent). Adding a provider later = one new file, no frontend change.
- `/settings/api` page, admin-only: one row per provider showing Connected / Invalid / Not configured, a "Test" button that runs the lightweight health request server-side, and last-checked time. Keys are never sent to the browser — only status.
- Retries with backoff, timeouts, structured logging into `generation_events`.

## Phase 3 — Generation pipeline (real calls, no mocks)
Runs entirely in server functions, one row in `generations` tracked step by step:
```text
prompt / uploaded script
  -> OpenRouter (Groq fallback): script, scenes, narration, captions, title, hashtags
  -> Runway: video clips per scene
  -> ElevenLabs: narration audio
  -> Pollinations / Stability: images + thumbnail
  -> asset combination -> final MP4 in storage
  -> Coasty (optional): trend research, thumbnail polish, QA, publish
  -> return download link + post links
```
The UI polls the generation record, so the hero form shows live step-by-step progress, then a preview with Download / Regenerate.

## Phase 4 — Social accounts (OAuth)
- `/settings/social`: connect YouTube (Google), Instagram (Meta), TikTok. Only encrypted tokens stored server-side, never credentials.
- Coasty uses these to publish with per-platform captions/hashtags.

## Things I need from you
1. **Video merging.** Combining clips + audio + captions into one MP4 needs a media pipeline; the app's server runtime can't run ffmpeg. Options: (a) do the merge via Coasty's computer-use agent, (b) use a hosted rendering API (e.g. Shotstack/Creatomate — needs another key), or (c) v1 returns the Runway clip + separate narration track. Which do you want?
2. **Social OAuth apps.** YouTube/Instagram/TikTok each require you to register a developer app and give me the client ID + secret (and TikTok/Meta need app review before posting works). Do you have those, or should I build Phase 4 last?
3. **Coasty.** I couldn't find public API docs for it — if you have the docs URL or base endpoint, share it; otherwise I'll wire it behind a clean adapter with the endpoint configurable.

If you're happy with this, I'll start on Phase 1 + 2 immediately (auth, database, provider registry, working API Settings page with real validation), then move to the pipeline.
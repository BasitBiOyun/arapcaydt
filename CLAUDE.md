# Arapça YDT Stüdyosu project instructions

## Scope and work style
- Work only on the user's requested scope.
- Inspect the relevant files before making claims or edits.
- Search by path, symbol, route, or feature first. Do not scan the whole repository unless necessary.
- Reuse existing architecture and patterns. Make the smallest correct change.
- Do not refactor unrelated code, add speculative abstractions, or add dependencies unless required.
- Do not create temporary reports, helper docs, or scratch files unless requested. Remove temporary files before finishing.
- For small, clear tasks, implement directly. For broad or risky changes, inspect first and make a short plan.
- Do not use agent teams. Use a subagent only for isolated investigation that would otherwise flood the main context.
- Keep working responses concise.

## Project architecture
- React 19 + TypeScript + Vite frontend.
- Express server entry is `server.ts`.
- ElevenLabs endpoints live under `api/elevenlabs/`.
- Gemini server-side analysis lives under `server/gemini/`.
- Auth is server-side and the approved-member flow must remain intact unless the task explicitly changes it.
- Remotion is used for video/animation work.
- Supabase-backed application data and credentials must remain server-safe.

## Security and external services
- Never expose, print, hardcode, or move API keys/secrets into client code.
- Do not change providers, models, billing-sensitive settings, or production credentials unless explicitly requested.
- Paid/external API calls are opt-in during development. Do not consume ElevenLabs, Gemini, or other paid credits merely to test a code change unless the user explicitly asks.
- Prefer deterministic tests, mocks, fixtures, and static validation before live service calls.

## Turkish + Arabic content
- Keep display/source text separate from speech-normalized text.
- Never alter user-facing Turkish or Arabic solely to force TTS pronunciation.
- Treat Turkish and Arabic segments deliberately. Do not let normalization for one language corrupt the other.
- Preserve question meaning, option identity, and the declared correct answer through TTS, analysis, timing, and video generation.
- Fix pronunciation issues in the speech-preparation layer rather than with ad-hoc changes to visible question text.
- Preserve word/timestamp alignment contracts when changing narration generation.

## Validation
Use the narrowest meaningful checks:
- `npm run lint` for TypeScript.
- `npm test` for relevant automated tests.
- `npm run build` when the change can affect production build/runtime.
Do not run expensive external generation as a substitute for local verification.

## Context efficiency
- Open only files needed for the task.
- Do not repeatedly reread unchanged files.
- Avoid loading large assets, generated media, or unrelated feature trees.
- Prefer one focused investigation and one focused implementation pass over repeated broad exploration.

---
name: voice-pipeline
description: Debug or change Turkish-Arabic narration, ElevenLabs TTS, voice selection, speech normalization, option-label pronunciation, timestamps, or narration alignment.
disable-model-invocation: true
---

Task: $ARGUMENTS

1. Inspect only the current narration path: the relevant `api/elevenlabs/` handler plus the client/service code that prepares or consumes the narration.
2. Identify whether the defect is in source text, speech normalization, language segmentation, voice/model settings, API payload, returned alignment, or downstream timeline handling.
3. Keep display/source text immutable unless the user explicitly asks to edit it. Build a separate TTS-safe representation when pronunciation needs normalization.
4. Preserve Turkish and Arabic characters and meaning. Do not use arbitrary visible-text hacks such as changing an option label just to influence pronunciation.
5. Keep option labels and declared answers semantically stable end to end.
6. Do not call paid TTS during diagnosis or tests unless the user explicitly asks for a live generation. Prefer fixtures, mocks, and deterministic tests.
7. If timestamps/alignment are involved, preserve the existing word/timing contract and verify downstream consumers.
8. Make the minimum change and avoid unrelated refactors or provider/model changes.
9. Run `npm run lint` and the smallest relevant `npm test` target. Run `npm run build` only when needed for integration confidence.
10. Finish with the root cause, changed files, verification, and whether a live ElevenLabs test is still needed.

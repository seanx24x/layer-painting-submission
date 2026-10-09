# Layer

A miniature-painting companion for preparing a study, understanding the next mark and returning to practice. Built by Sean Lynch with Next.js, Tailwind, TypeScript and Vercel AI Gateway.

- **Application:** https://layer-painting.vercel.app
- **Public submission source:** https://github.com/seanx24x/layer-painting-submission
- **One-page write-up:** [PDF](output/pdf/layer-submission-writeup.pdf) · [editable source](docs/submission-writeup.md)
- **Active time:** 5 hours 36 minutes

## Try one complete journey

1. Choose **Ultramarines → Classic → Warhammer 40,000** and open the guide.
2. Inspect the pauldron, compare the named primer, and check a paint and tool. Readiness is optional.
3. Start painting. Watch how a thin coat builds, then inspect **Before / Application / Result** and compare paint amount.
4. Ask **“How much paint goes on the brush?”** and use **Show me** to open the reviewed example.
5. Add a practice note, advance with **Next**, and try **Undo**. **Save and pause**, reload, and return from **My table**.

Playback and AI questions leave progress unchanged. Only the learner advances a guide step. Notes reopen at their original step.

## Design and implementation

I used my [Foundry](https://withfoundry.ai/) design skill to guide the design and refinement, alongside AI-assisted implementation. Browser review shaped the hierarchy, typography, spacing, tone and motion. The application does not embed the Foundry runtime.

Paint builds on stationary WebGL surfaces using a shared playback clock and deterministic stroke data. Replay, seeking, still checkpoints and fixed comparisons share that model. A readable SVG fallback handles unavailable WebGL; optional static diagrams explain brush contact. Light & form lets the learner place the light. The guide pauldron provides a movable palette reference, with its renderer loaded near the viewport.

Device-local sessions preserve materials, notes and progress without signup. Saving includes explicit error recovery; cross-device sync is outside this version. Discovery, guide preparation and the Workbench load separately, with server rendering retained.

## Vercel AI Gateway

[`POST /api/coach`](src/app/api/coach/route.ts) uses AI SDK `generateText` and structured output through [Vercel AI Gateway](https://vercel.com/docs/ai-gateway/getting-started). The default model is `google/gemini-2.5-flash-lite`; `AI_GATEWAY_MODEL` can override it server-side.

The model selects an allowed note ID for the current lesson. The server supplies unchanged authored guidance, sources and a validated demonstration action. It does not generate physical instructions, assess the miniature or change progress. Reviewed fallback guidance remains available without AI. Requests are bounded and stale client requests are cancelled. Only the submitted question and lesson context go to AI; practice notes and progress stay local. Responses are non-streaming.

## Run locally

Requires Node.js **22.15 or newer**.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. For live local AI, copy `.env.example` to `.env.local` and supply a Vercel AI Gateway key. Without credentials, reviewed guidance works. Never commit `.env.local`.

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm start
```

Run TypeScript and build sequentially because Next regenerates route types. The build uses webpack. Two tests requiring the excluded original STL skip when it is absent; production-buffer and JSON-fixture checks still run.

## Code map

| Area | Location |
| --- | --- |
| Routes and server endpoints | [src/app](src/app) |
| Guide and Workbench UI | [GuideOverview.tsx](src/components/GuideOverview.tsx), [Painting.tsx](src/components/Painting.tsx) |
| Practice state | [PracticeProvider.tsx](src/components/PracticeProvider.tsx), [practice-storage.ts](src/lib/practice-storage.ts) |
| Reviewed AI contract | [coach.ts](src/lib/coach.ts), [coach-request.ts](src/lib/coach-request.ts) |
| Paint evaluation and rendering | [surface-painting.ts](src/lib/surface-painting.ts), [surface-painting-renderer.ts](src/lib/surface-painting-renderer.ts) |
| Guide armour reference | [guide-pauldron.ts](src/lib/guide-pauldron.ts), [pauldron-viewer.ts](src/lib/pauldron-viewer.ts) |
| Sourced content | [guides.ts](src/lib/guides.ts), [src/data](src/data), [equipment-products.json](src/lib/equipment-products.json) |

## Assets and boundaries

Digital colours and paint coverage are illustrations, not calibrated matches or fluid simulation. Completion records guide progression, not verified painting skill.

The pauldron retains 85,424 source triangles. Its [public manifest](public/models/pauldron/manifest.json) records geometry checksums, surface regions and display-normal repairs. The original STL is excluded, but its lossless public buffer preserves the geometry. The creator/source and redistribution terms remain unconfirmed. See [asset provenance](docs/asset-provenance.md) for that disclosure, the separate full-miniature attribution and generated artwork details. No affiliation with Games Workshop is claimed.

The development technique studio returns 404 in production. Credentials, original STL, local captures and documentation are excluded from deployment. To regenerate the one-page PDF, run `python scripts/docs/export-submission.py` with ReportLab, pypdf, fontTools and Brotli installed; it uses the bundled DM Sans font and asserts one page.

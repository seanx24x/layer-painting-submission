# Layer

Sean Lynch · Vercel Design Engineer take-home · 9 October 2026

**A considered place to practise miniature painting.** Painting is a personal interest, and I wanted to explore a companion for the moments around the miniature: choosing a palette, understanding the next mark and returning to an unfinished study. Layer brings those decisions into one continuous workflow, with materials, demonstrations, contextual help and saved notes close to the work.

**Designing through Foundry.** I used my [Foundry](https://withfoundry.ai/) design skill to guide the site's design and refinement, alongside AI-assisted implementation. I directed the hierarchy, typography, spacing, tone and interactions through repeated browser review. The important change was restraint: oversized illustrated brushes gave way to quiet white surfaces where the paint itself demonstrates the technique. Controls sit inside the stage; optional detail stays out of the primary reading path. The same visual language carries through the guides, equipment and technique library.

**Vercel AI Gateway, with a deliberate boundary.** The Workbench coach uses the Vercel AI SDK and AI Gateway to match a question to reviewed guidance for the current step. Structured output selects an allowed note; Layer supplies its exact teaching text, sources and an authored “Show me” demonstration. A live model response had reversed advice about excess paint, so I narrowed its role from writing instruction to selecting guidance. AI cannot invent a technique, grade the miniature or complete a step. Reviewed fallback guidance keeps the lesson useful when AI is unavailable.

**Make the workflow dependable.** Next.js, Tailwind and TypeScript support a responsive app deployed on Vercel. Deterministic paint studies share one playback clock, with Before, Application and Result checkpoints, adjustable paint amount and a fixed reference. WebGL has a readable SVG fallback. Only the learner advances practice; Next has Undo, notes reopen at their original step, and saved progress survives reload. The interactive pauldron adds a movable palette reference while keeping lesson progression separate.

**Tradeoffs and assumptions.** Device-local saving removes signup friction but gives up cross-device continuity. Digital colours and paint coverage are illustrations, not calibrated matches or fluid simulation. The catalogue grew beyond the initial foundational scope; one complete Ultramarines journey is the clearest demonstration. I am testing the hypothesis that keeping these decisions together helps practice, not claiming a measured learning outcome.

**Next.** Desk-test one lesson with a beginner, evaluate AI note-selection relevance, and add durable usage limits before broader release. Prioritise that evidence over more catalogue breadth.

**Delivery:** [Application](https://layer-painting.vercel.app) · [GitHub](https://github.com/seanx24x/layer-painting-submission) · Active time: **5 hours 36 minutes**.

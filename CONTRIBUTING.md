# Contributing to Fluxygram

Thanks for helping. Issues, ideas, diagrams and pull requests are all welcome, in English or Spanish.

## Where things go

| You want to… | Go to |
| --- | --- |
| Ask a question, share a diagram, propose an idea | [Discussions](https://github.com/Fluxygram/fluxygram/discussions) |
| Report something that's broken | [New issue → Bug report](https://github.com/Fluxygram/fluxygram/issues/new/choose) |
| Ask for a concrete feature | [New issue → Feature request](https://github.com/Fluxygram/fluxygram/issues/new/choose) |
| Report a security problem | [Private report](https://github.com/Fluxygram/fluxygram/security/advisories/new), never a public issue ([details](SECURITY.md)) |

For anything bigger than a small fix, open an issue or a discussion first so we can agree on the approach before you spend time on it.

## Setup

You need Node 20.11+ (22 recommended) and [pnpm](https://pnpm.io) 9+.

```bash
git clone https://github.com/Fluxygram/fluxygram.git
cd fluxygram
pnpm install
pnpm dev        # site, editor and presentation mode at http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs the site with the component built from source |
| `pnpm typecheck` | Type-checks the whole monorepo |
| `pnpm build` | Builds the site (also runs in CI) |
| `pnpm build:packages` | Builds the npm packages into `packages/*/dist` |

## Where the code lives

| Path | What's there |
| --- | --- |
| `packages/core` | The format: types, validation, layout for every diagram type, motion planning. No DOM. |
| `packages/element` | `<fluxy-gram>`: SVG rendering, animation, camera, gestures, styles, icons. |
| `packages/fluxygram` | Single-file build for CDNs (generated, nothing to edit by hand). |
| `site` | Landing, editor (`/play`), viewer and presentation mode. Texts in `site/public/i18n.js`. |
| `skills/fluxygram` | The agent skill (`SKILL.md`) and its example diagrams. |
| `site/public/schema/v1.json` | JSON Schema of the format. |

## Pull requests

- Keep each PR about one thing. Small PRs get reviewed faster.
- Run `pnpm typecheck` and `pnpm build` before opening it.
- If you change the format (a new field, a new diagram type), update all of these together: `packages/core` (types, validation, layout or motion), `site/public/schema/v1.json`, `skills/fluxygram/SKILL.md`, and an example in `site/public/examples` and `skills/fluxygram/examples`.
- Every user-facing text goes in `site/public/i18n.js` in **both English and Spanish**. Validation messages in `packages/core` are bilingual too.
- For visual or motion changes, add a short video or GIF to the PR.
- Motion should help people understand, never decorate. Animations are interruptible, fast (most under 300 ms), and respect `prefers-reduced-motion`.

## Licensing of contributions

Your contribution is published under the license of the folder it lands in: MIT for `packages/*` and `skills/*`, FSL-1.1-ALv2 for `site`. See [LICENSE.md](LICENSE.md).

Before your first pull request can be merged, you sign the [Contributor License Agreement](CLA.md) once: a bot comments on the PR, and you reply with the sentence it gives you. You keep ownership of your work. The CLA lets the project use contributions in any product, open source or commercial, and change licenses in the future without having to find every past contributor.

## Conduct

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

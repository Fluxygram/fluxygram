# Licensing

Fluxygram uses two licenses, depending on the part of the repository.

| Path | License | In short |
| --- | --- | --- |
| [`packages/core`](packages/core/LICENSE) | MIT | Use it anywhere, for anything. |
| [`packages/element`](packages/element/LICENSE) | MIT | Embed `<fluxy-gram>` in any site or product, commercial or not. |
| [`packages/fluxygram`](packages/fluxygram/LICENSE) | MIT | The single-file build of the component. |
| [`skills/fluxygram`](skills/fluxygram/LICENSE) | MIT | Give the skill to any agent, ship it in any tool. |
| `docs` | MIT | The documentation at docs.fluxygram.app. |
| [`site`](site/LICENSE.md) (landing, editor, presentation mode) | FSL-1.1-ALv2 | Read it, change it, run it for yourself or your company. You can't offer it as a competing commercial service. Each version becomes Apache 2.0 two years after its release. |

The diagram format (`.flux.json`) and its JSON Schema are open: anyone can write, read and render it.

If a file sits inside one of those folders, that folder's license applies. The exception is third-party code in [`site/src/vendor`](site/src/vendor): each file there keeps its own license, written at the top of the file (for example, `tech-text.ts`, `rubber-segment.ts`, `specular-button.ts` and `magic-rings.ts` come from React Bits under MIT + Commons Clause). Anything else in the repository (build configuration, scripts, docs) is MIT.

Contributions are accepted under the [Contributor License Agreement](CLA.md); see [CONTRIBUTING.md](CONTRIBUTING.md).

"Fluxygram" and its logo are trademarks of the project; the licenses above don't grant rights to them.

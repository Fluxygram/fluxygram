# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems.

Report it privately through GitHub: [open a security advisory](https://github.com/Fluxygram/fluxygram/security/advisories/new). Only the maintainers can see it. Include what you found, how to reproduce it, and what an attacker could do with it.

You'll get an answer within a few days. Once there's a fix, we'll publish it and credit you, unless you prefer to stay anonymous.

## What's in scope

- `@fluxygram/core`, `@fluxygram/element` and `fluxygram` on npm. For example: a diagram file that runs script in the page that renders it.
- The site at [fluxygram.app](https://fluxygram.app): the editor, share links, and presentation mode.
- The agent skill in `skills/fluxygram`.

## Supported versions

Fixes go into the latest published version. Diagram files are data: if a `.flux.json` can make the component run code, that's a bug we want to hear about.

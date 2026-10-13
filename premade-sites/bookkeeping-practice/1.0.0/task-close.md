# Task close — Ledger & Loom bookkeeping template

## Delivery state

- Local draft source only under `premade-sites/bookkeeping-practice/1.0.0/`.
- No catalog promotion, commit, push, deployment, Cloud import, WordPress import, or browser acceptance performed.
- Workflow selection, targets, host QA, independent visual review, and user approval remain empty.

## Verification

- `npm run template -- build bookkeeping-practice 1.0.0` — exit 0.
- `npm run template -- check bookkeeping-practice 1.0.0` — exit 0; draft reproducibility valid.
- `npm run template -- status bookkeeping-practice 1.0.0` — exit 0; expected `revision` state because human selection, both-host QA, independent visual review, and approval are intentionally empty.
- Draft package SHA-256: `82be8c808123ae17e4a14826f4fd70664164704fc4f9529452ebe12871bbe53b`.
- Portable archive integrity passed with no compressed-data errors. Four compiled pages and all internal page/anchor links resolved.
- Native-document inspection found 255 nodes, 10 images with no missing alt text, 12 color tokens, 8 text styles, one reusable native class, one shared header, and one shared footer.
- Key text contrast ratios range from 5.22:1 to 15.14:1. Authored buttons and links use at least 44px height; primary buttons use 48px.
- Main-agent browser review and Cloud/WordPress host acceptance remain required.

## Known limitation

Pagecraft core currently emits its native mobile-nav toggle at 40×40px. This template uses the required native dropdown menu and does not add custom CSS or edit shared core outside the assigned folder. Browser QA should record the 40px core control against the 44px target or pair this package with an authorized core-level fix.

## Review route

After a successful draft build, open `premade-sites/bookkeeping-practice/1.0.0/draft/preview/index.html` and follow native page links for Services, Approach, and Contact.

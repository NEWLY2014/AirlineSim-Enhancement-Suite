# AES Documentation

[Project overview](../README.md) · [User manual](user-manual.md) · [Developer manual](developer-manual.md)

Start with the user manual to install and use AES, or the developer manual to build, test and contribute.

## Manuals

- [User manual](user-manual.md): installation, pricing settings and feature guidance.
- [Developer manual](developer-manual.md): development, testing, notifications, the shared page queue and localization checks.

## Development references

- [Localization](development/localization.md): supported languages, catalogs and translation conventions.
- [Release automation](development/release-automation.md): versioning, Chrome Web Store submission and stable release policy.
- [Pricing data example](examples/pricing-data.js): illustrative data, not the authoritative storage schema.

## Store materials

- [Chrome Web Store listing](store/chrome-web-store-listing.md): name, description and listing copy.

## Historical records

These records retain the findings and verification results from their original work. They are not current setup instructions; test counts, status statements and implementation details may have changed.

- [Feature parity audit — 2026-09-24](archive/feature-parity-audit-2026-09-24.md): comparison with 0.8.13, reproduced upgrade regressions and validation limits; includes [baseline probes](archive/parity-audit-2026-09-24.repro.cjs).
- [TypeScript migration](archive/typescript-migration.md): migration checkpoints and build transition.
- [jQuery upgrade assessment](archive/jquery-upgrade-assessment.md): compatibility investigation and upgrade decision.
- [Code audit — 2026-09-09](archive/code-audit-2026-09-09.md): findings and repair status. The [companion launcher](archive/audit-2026-09-09.repro.cjs) now runs regression tests.
- [Schedule performance — 2026-09-10](archive/schedule-performance-2026-09-10.md): large-airline storage and responsiveness work.
- [Read-only collection — 2026-09-10](archive/read-only-collection-2026-09-10.md): the initial direct-request collection rollout.
- [Collection feedback — 2026-09-10](archive/collection-feedback-2026-09-10.md): progress feedback and synchronized refresh work.

## Keeping documentation organized

Keep the two manuals at this directory's root. Put maintained technical references in `development/`, listing copy in `store/`, illustrative code in `examples/`, and dated investigations or completed implementation reports in `archive/`. Add new documents to this index and update relative links when moving files.

# Security Policy

## Public Showcase Scope

HAZA AIOS is published as a source-available portfolio/evaluation repository. It is not offered as production-ready hosted software and is not licensed for production deployment or commercial reuse without written permission.

## Reporting Security Issues

If you discover a security issue, do not open a public GitHub issue with exploit details, credentials, private data, or proof-of-concept payloads.

Report concerns privately to the repository owner through GitHub profile/contact channels or by opening a minimal issue that requests a private security discussion without technical exploit details.

## Supported Versions

Only the default branch is considered current for public review. Older branches are retained for development history and may not receive security updates.

## Security Expectations

- Do not commit secrets, API keys, credentials, private keys, or real production data.
- Use `.env.example` files only for placeholders and documentation.
- Keep real environment values outside Git.
- Rotate any credential immediately if it is ever committed by mistake.
- Review GitHub Actions logs and artifacts before exposing operational workflows publicly.

## Current Status

This repository is under active development. Public availability is intended to demonstrate engineering progress, architecture, and implementation quality. It should not be treated as a production deployment reference without a separate security review, deployment hardening pass, and operational runbook.
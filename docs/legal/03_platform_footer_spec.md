# Platform Footer Disclosures and Integration Notes

Effective date: June 6, 2026  
Version: 2026-06-06-v2  
Target site: spark.tcwglobal.com

This document defines the footer disclosure and integration notes for Spark.

## Footer disclosure

Recommended compact footer copy:

> Spark uses permission-based device access and AI-assisted workflow tools to
> support candidate screening, fraud prevention, and jurisdiction review. Final
> hiring decisions are made by human reviewers. California candidates and other
> eligible users may exercise privacy rights or request manual review without
> penalty.

Required footer links:

- California AI Disclosure & Terms
- Notice at Collection
- Your Privacy Choices / Do Not Sell or Share My Info
- Request Non-AI Alternative Pathway

## Privacy choices endpoint

The privacy choices page should provide a clear way to request access,
correction, deletion, restriction, sale/share opt-out, limitation of sensitive
personal information where applicable, and manual review.

If TCWGlobal or Cloud Motion Technologies maintains a centralized corporate
privacy request form, the Spark privacy choices page should link to that form.
Until then, it may route requests to compliance@tcwglobal.com.

## Manual review hook

The manual review link should be action-oriented. Within an application flow, it
should switch the candidate to the manual pathway and submit the application as
manual review requested. Outside an application flow, it should explain the
manual pathway and direct candidates to choose that option on the apply page or
contact compliance@tcwglobal.com.

## Reapplication mitigation ledger

Future backend work should implement a dedicated mitigation ledger only after
legal and security review. Recommended safeguards:

- use `UPDATE ... SET field = null`, not schema-level `DROP`, for erasure;
- hash contact vectors with canonicalization and a server-side secret pepper;
- avoid describing names as non-sensitive;
- document retention criteria and deletion exceptions;
- store consent/disclosure version with terminal application events;
- keep recruiter-visible records minimal and purpose-limited.

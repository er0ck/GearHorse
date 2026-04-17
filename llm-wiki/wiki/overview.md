---
title: Overview
type: overview
tags: [gearhorse, overview, synthesis]
created: 2026-04-14
updated: 2026-04-16
sources: 6
---

# Gear Horse Wiki — Overview

This wiki covers the founding, strategy, products, and technical infrastructure of [[Gear Horse]], a pre-launch American-made camping gear brand based in Oregon.

---

## What Gear Horse is

A DTC e-commerce and Kickstarter brand building premium camping accessories manufactured entirely in the USA. Three founding products target a gap left by the camping gear market's heavy reliance on Asian manufacturing:

- [[Trail Maul]] — a camp-scale splitting maul that doesn't exist at retail
- [[Ember Lid]] — a folding cast-iron campfire pizza dome with no current equivalent
- [[Chair Armor]] — model-specific camp chair covers, no US-made option exists at any price

The brand's competitive moat is origin and manufacturing story, not product category novelty. See [[Made in USA Brand Positioning]].

---

## The strategy

[[Zero-Capital Launch Strategy]] is the governing framework. Four phases: validate demand with email subscribers before spending on manufacturing, crowdfund via Kickstarter, run first production batch, then grow organically. Each phase gates the next. No inventory risk in Phases 1 and 2.

The ultimate goal is acquisition by an outdoor brand within 5 years. The strategy is designed around that exit from day one: clean corporate structure, IP filings on schedule, recurring revenue via consumables subscription, and brand metrics tracked from the beginning.

---

## The retention model

[[Community Over Subscription]]: the email list and any subscription are infrastructure. The brand narrative — the founding campfire story, the American forge workers, the first imperfect tests — is the actual product. Segmenting subscribers by activity type at signup and leading with genuinely useful content (not product pitches) is the documented pattern for outdoor brands with high retention.

The Gear Horse-specific subscription model: quarterly consumables (seasoning oil, fire-starter) tied to owning the [[Ember Lid]]. Defensible because the product is a prerequisite.

---

## The tech stack

[[Carrd Make Notion Stack]] is a near-free no-code marketing stack: Carrd Pro Lite (landing pages) + Make (automation middleware) + Notion (CRM) + Brevo (email). Total cost under $20/year until Kickstarter, when Shopify joins.

[[UTM Tracking]] is wired from day one: hidden Carrd fields capture UTM params from URL query strings, Make maps them to Notion, a Formula property produces a readable source/medium label in the CRM view.

[[Honeypot Spam Protection]] provides free, no-friction bot protection via server-side heuristics and a Make-side filter. Cloudflare Turnstile is an optional Carrd upgrade. Carrd does NOT use Google reCAPTCHA.

[[Inbound Email Capture]] is a second acquisition channel: visitors who email `hello@gearhorse.camp` directly are pushed into Brevo via Make watching Gmail, using the existing ImprovMX forwarding chain. No Carrd changes required.

[[CI for No-Code Stack]] uses GitHub Actions (free tier) to test the stack in two tiers: a fast Brevo API-only test on every push (~2s), and a full Playwright E2E run nightly (~30–60s). The API-only test is the primary fast canary; the E2E catches Carrd-side regressions. See [[Brevo API Testing]] for test isolation strategy, attribute pre-flight setup, and Brevo API gotchas.

---

## Current state (as of 2026-04-16)

- Brand name, domain, and tagline: decided
- Products: defined, not yet manufactured or prototyped
- LLC: not yet formed
- Landing page: Carrd Pro Lite in place
- UTM tracking: wired
- Testing: GitHub Actions workflows in place
- Kickstarter: not yet launched
- Email list: not yet at 500 (Phase 1 goal)

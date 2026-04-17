---
title: Index
type: index
tags: [index, catalog]
created: 2026-04-14
updated: 2026-04-16
sources: 0
---

# Wiki Index

Complete catalog of all pages in this wiki.

---

## Overview

- [[Overview]] — High-level synthesis of the Gear Horse wiki

---

## Entities

### Company
- [[Gear Horse]] — American-made camping gear brand, pre-launch, Oregon

### People
- [[Eric Thompson]] — Co-Founder & Brand Lead at Gear Horse

### Products
- [[Trail Maul]] — Mini splitting maul (~2.5 lbs, US drop-forged steel), $89–$109
- [[Ember Lid]] — Folding cast-iron campfire pizza lid, $74–$94
- [[Chair Armor]] — Model-specific camp chair covers (waxed canvas/Cordura), $38–$54

---

## Concepts

### Strategy
- [[Zero-Capital Launch Strategy]] — 4-phase launch plan: validate → crowdfund → first run → grow
- [[Made in USA Brand Positioning]] — Core competitive moat; defensible against knockoffs, improves exit value

### Marketing & Retention
- [[Community Over Subscription]] — Brand narrative drives loyalty; segment at signup; consumables subscription tied to product ownership

### Tech Stack
- [[Carrd Make Notion Stack]] — Near-free no-code marketing + CRM stack (Carrd + Make + Notion + Brevo)
- [[UTM Tracking]] — Carrd hidden fields → Make → Notion CRM property mapping
- [[Honeypot Spam Protection]] — Server-side heuristics + Make filter; Cloudflare Turnstile optional (not reCAPTCHA)

### Infrastructure
- [[Domain and Email Infrastructure]] — Domain registrar options, email hosting (ImprovMX/Zoho/Migadu), DNS integration with Carrd and Shopify
- [[Inbound Email Capture]] — Make + Gmail watches hello@gearhorse.camp, pushes direct emailers to Brevo

### Engineering
- [[CI for No-Code Stack]] — Two-tier GitHub Actions: API-only per push, Playwright E2E nightly
- [[Brevo API Testing]] — Brevo API contract, test isolation strategy, gotchas, no-sandbox workarounds

---

## Source Summaries

- [[summary: gearhorse-founding-context]] — Founding story, brand identity, products, business plan, exit strategy, retention research
- [[summary: gearhorse-hosting-options]] — Hosting options evaluated for marketing site (Framer, Webflow, Carrd+blog, Astro)
- [[summary: gearhorse-tech-stack-setup]] — Full tech stack setup guide: Carrd → Make → Notion, UTM, spam protection
- [[summary: testing-carrd-make-notion-github-actions]] — GitHub Actions testing for Carrd/Make/Notion stack with Playwright
- [[summary: domain-email-infrastructure]] — Domain registrars, email hosting options, DNS integration, TLD watch-outs
- [[summary: capture-emailme-link-footer-crm]] — Make + Gmail flow to capture direct emailers into Brevo CRM
- [[summary: test-brevo-CRM]] — Two-tier Brevo testing: API-only canary + nightly Playwright E2E; isolation, gotchas, CAPTCHA reality

---

## Log

- [[Log]] — Append-only chronological log of wiki activity

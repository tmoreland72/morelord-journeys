---
title: Morelord Journeys Documentation
description: Plan and run structured D&D 5e travel days with supplies, player checks, encounters, foraging, and camp.
slug: morelord-journeys
product: morelord-journeys
version: 0.3.8
foundry: 14
order: 0
---

# Morelord Journeys Documentation

Morelord Journeys turns overland travel into a shared expedition workflow. A Game Master defines the route and party, then resolves each travel day through Weather, Pace, Encounters, Discovery, Foraging, Navigation, Press On, and Camp.

Journey distance uses exact thirds of a normal travel day. Routes can begin with fractional lengths, and pace, weather, discoveries, navigation, and forced marches add or remove thirds while the original plan remains visible.

## Choose a guide

- [Game Master Manual](gm-manual.md) — installation, journey setup, every travel phase, supplies, camp, integrations, and troubleshooting.
- [Game Master Travel Rules Reference](gm-travel-rules-reference.md) — draft granular rules for the planned travel-mechanics update.
- [Player Guide](player-guide.md) — responding to roll requests, managing supplies, keeping watch, and understanding expedition results.

These guides describe Morelord Journeys 0.3.4 for Foundry Virtual Tabletop v14 and D&D 5e 5.3 or later.

Developer regression: in Dev1, import `plannerFooterCheck` from `scripts/testing/planner-footer.mjs` and pass it to Core's `runChecks([plannerFooterCheck])` or `runInGameTests({ checks: [plannerFooterCheck] })`. It renders the planner with harmless fixture actions, checks footer scrolling and click routing at 720px/400px, and verifies new and previously posted watch labels without changing world data.

Version 0.3.8 adds Long Rest chat actions after Sleep & Shelter, keeps planner actions visible, and corrects watch request labels. Requires Morelord Core 0.3.15 or later.

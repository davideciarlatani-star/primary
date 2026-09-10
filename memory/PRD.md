# BonusRadar — PRD

## Problem Statement (original, IT)
App mobile per monitorare in tempo reale aiuti, bonus, detrazioni e rimborsi statali per le varie tipologie di soggetti, inserendo la minor quantità di dati personali. Dopo il profilo, l'app costruisce e monitora il calendario delle scadenze per domande/dichiarazioni. Simulazione per chi non ha mai dichiarato: mostra i vantaggi di mettersi in regola. Collegamento ad account esistente (SPID/INPS) desiderato.

## Architecture
- Frontend: Expo Router (React Native), tab nav (Bonus / Calendario / Simulazione / Profilo), profilo locale via storage util (no login).
- Backend: FastAPI, catalogo curato di 12 bonus italiani con regole di eleggibilità in Python; endpoint /api/match, /api/calendar, /api/ai/suggest, /api/simulate, /api/bonuses, /api/bonus/{id}.
- AI: EMERGENT_LLM_KEY (gpt-5.4) via emergentintegrations, con fallback rule-based robusto.
- Design: blu istituzionale + arancio (design_guidelines.json), iOS-Native Clean.

## User Personas
- Famiglie con figli, redditi bassi, giovani in affitto, proprietari di casa, disoccupati, e in particolare chi non ha mai dichiarato (evasori) che vuole capire i vantaggi.

## Core Requirements (static)
- Profilo minimo guidato; matching bonus; calendario scadenze; simulazione vantaggi; privacy (dati solo on-device).

## Implemented (2026-06)
- Onboarding wizard 7 step + profilo locale.
- Home con hero, ricerca bonus per parola chiave, card AI suggerimenti, lista bonus idonei/altri.
- Dettaglio bonus (importo, scadenza, come richiederlo, ente) con banner "non accessibile" in cima per bonus non idonei e pulsante "Aggiungi a Google Calendar" (Premium, link rapido).
- Guide passo-passo Premium con pulsante "Bloccato?" per passo (immagini placeholder) sui 3 bonus pilota.
- Calendario scadenze ordinate con badge urgenza.
- Simulazione AI (before/after, breakdown) per non-filer, con fallback.
- Profilo con dati, modifica e reset. Tutti i flussi testati (backend 10/10, frontend e2e).

## Backlog
- P1: Collegamento SPID/INPS (mock guidato) — API pubbliche non disponibili a terzi.
- P1: Notifiche promemoria scadenze (solo su richiesta utente / build reale).
- P2: Filtri per categoria in Home; ricerca bonus; salvataggio "domande completate".
- P2: Fonti/link ufficiali cliccabili per ogni bonus.

## Next Tasks
- SPID/INPS mock connection screen; category filter chips in Home.

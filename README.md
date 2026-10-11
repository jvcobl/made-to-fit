# Made to Fit

A free 3D browser game about person-environment fit, about 40 minutes, plus two short return visits. You make a small creature, set up your room the way you like it (light, sound, company, how you like to be told things, when your day starts, how much change you like), then spend three days in Larkspur, a cozy town planned around a statue of the "Standard Resident" that nobody actually matches. When a place doesn't fit you, the game asks one question: who adjusts? You can push through, use gear, ask someone, note a fix for the town, or leave, and each answer costs someone something. Ten and twenty years later you can come back and see what lasted.

The playable build is one self-contained HTML file (Three.js is bundled in; only Google Fonts load from outside). It runs on desktop and phone browsers, with keyboard, mouse or touch.

## What's in it
- **Act 1, Arrival (three days).** Work at the Works (sort the mail, stamp permits), meet eight residents, sketch fixes at the Fix-It Shed, find backers, and take proposals to the town meeting on Tuesday at six. Wednesday is the Lantern Festival, then "Who decided?" looks back at a few of your moments, and an ending page says what Larkspur will remember.
- **Act 2, Ten Years On, and Act 3, Twenty Years On (one day each).** Your fixes in use and aged, a robot built to the founders' spec, a kiosk that listens to one kind of voice, a crossing timed to the Standard's stride, a newcomer whose needs are the opposite of yours, and the Shed in your hands.
- **Hands-on tasks.** Sort, Stamp, the zoning sketch and the plain note, fishing, painting lanterns, festival mail and teaching the robot the room as it is. Every task has a calm pace with no timer.
- **Saving.** The game saves on the device as you play (calm moments, room changes, opening the menu, closing the tab) and Continue returns to the same minute and spot. "Play on another device" in the menu gives a save code or a save file; "Played before?" on the title screen opens either. Nothing leaves the device unless the player copies it.
- **Access.** Text size, reduced motion, an optional mood tint, captions for sounds, a calm task pace, remappable keys, a screen-reader feed for every line and card, and no flashing above three times a second (checked frame by frame).
- **Field notes.** Short notes with sources and evidence-strength tags, unlocked after the thing they describe has happened.

## Build
```
npm install
node build.mjs            # dist/who-bends.html, a full page for local play and tests
node build.mjs artifact   # dist/who-bends-artifact.html, without document tags, for publishing as a claude.ai artifact
```

## Files
- `src/main.js`: the game loop and the world (movement, residents, crowds, autosave triggers, test hooks).
- `src/story.js`: Act 1 (prologue, days, cards, talk, fixes, the meeting, the festival, the ending) and saving.
- `src/returns.js`, `src/act2.js`, `src/act3.js`, `src/talk23.js`: the return visits.
- `src/content.js`, `src/notes.js`: every word (cast, conversations, cards, endings, field notes).
- `src/sim.js`: the fit engine. `src/save.js`: saves, codes and validation. `src/files.js`: save files.
- `src/render.js`, `src/town.js`, `src/rooms.js`, `src/creature.js`, `src/robot.js`, `src/layers.js`, `src/lod.js`: the 3D world, built procedurally.
- `src/ui.js`, `src/menus.js`, `src/style.css`: the interface. `src/games/`: the tasks.

## Testing
URL parameters for local runs: `?test=1` (lighter rendering), `fast=1` (fast time, instant text), `mute=1`, `seed=N`, `fixedstep=1` (nothing advances by itself; `window.__wb.step(n)` advances everything by n frames), `autosave=0`, `comfort=1`.

- `python3 test/human.py <desktop|phone> <engaged|pusher|mixed> <outdir>` plays the whole game the way a person does (real clicks, taps and keys, the real clock), writes every word on screen to a transcript and screenshots each new screen.
- `python3 test/autosave.py` checks saving as you play, Continue, leaving the page, the save code and the save file.
- `python3 test/tasks_view.py` screenshots every task on a laptop and a phone.
- `python3 test/keys.py` plays conversations with the keyboard only (E, Space, Enter) and checks that the key that closes the last line doesn't start the conversation again.
- `node test/check_content.mjs` checks every script (labels, conditions, flags, notes).
- `python3 test/play.py`, `act2.py`, `act3.py`, `saves.py`, `saves23.py`, `a11y.py`, `phone23.py`, `perf.py`, `flash.py` and the rest cover endings, the later visits, saves, accessibility (axe), phone layout, draw-call budgets and photosensitivity.

Headless Chromium renders with SwiftShader: run browser tests one at a time on a small machine.

## Known gaps
- No cold human playtests yet; the automated players stand in for them.
- Mini-game timing was tuned in headless SwiftShader; check it on real phones and laptops.
- Each resident has a few short conversations; a release would want more writing, and the Korean translation.

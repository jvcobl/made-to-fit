# Who Bends, prototype 5

A free, roughly 30-minute 3D browser game about person-environment fit. You build your own creature, set your needs by arranging your new room, and spend three days in Larkspur, a cozy town planned around a statue of the "Standard Resident" that nobody actually matches. When a place pinches, the game asks one question: who adjusts?

The playable build is one self-contained HTML file (Three.js is bundled in; only Google Fonts load from outside).

## New in prototype 5
- **Seven hands-on tasks.** Sort the mail and check lantern permits at the Works, sketch fixes on graph paper at Clover's shed (a zoning puzzle and a plain-language note), fish at the pond, paint lanterns for people you know, and Blend's feed. The room is the difficulty: glare, chatter, interruptions and drift come from the live fit engine, and the results say what the room cost you. Every task has a Calm pace with no timer and can be skipped.
- **Interruptions are a choice.** Someone stops at your desk: "Sure, go ahead" answers now, "In a sec?" sends them back until you finish.
- **Clear wayfinding.** Bea walks you to work on day one, signposts, a lantern beacon, an edge arrow, a "Show the way" trail and a route on the phone map. The clock card always says what is next and where.
- **People who remember you.** Lantern's People guide fills as you listen: what is too much and too little for each resident, how they say no, what helps. Three lines unlock a postcard of how they bend too. After a first chat you guess how it went; what they say later is usually warmer. Residents who know you adjust places before you ask, in whichever direction you need.
- **Blend's economy.** Smooth Mode spends Calm, and Calm comes from a feed with random prizes, an odds drawer and wanting/enjoying meters. Blend's nudges stay inside the story and can be turned off.
- **Natural endings.** A jar of twelve kept moments, a pond that goes still after three fish, and dusk that ends the day.
- **Field notes.** 27 short notes with sources and evidence-strength tags, each unlocked after the thing it describes has happened.

## Build
```
npm install
node build.mjs            # dist/who-bends.html, a full page for local play and tests
node build.mjs artifact   # dist/who-bends-artifact.html, without document tags, for publishing as a claude.ai artifact
```

## Files
- `src/main.js` runs the game loop and the world: movement and collision, residents on routines, crowds, the sensory mapping from fit to light, sound and camera, Blend's mechanics, input and the `window.__wb` test hooks.
- `src/story.js` runs the season: title, prologue, room setup, days, shifts, the "who adjusts?" barriers, hints and Lantern, the fix pipeline, the council, the festival and the ending. It also interprets the scripts in `content.js`.
- `src/content.js` holds every word: cast and routines, conversations, hints, barrier text, Blend's copy, endings and field notes.
- `src/sim.js` is the fit engine and season state: place levels by time of day, pinch in both directions, drains and recovery, the 1,000-resident town-fit model, fixes and endings.
- `src/render.js` covers the renderer, sky, daylight, post-processing (bloom plus a color grade that carries the sensory effects), the camera rig and the see-through circle.
- `src/town.js` and `src/rooms.js` build the town and the three interiors procedurally, with no model files.
- `src/creature.js` builds creatures from one parametric body, so a look can drift smoothly toward the Standard Resident.
- `src/audio.js` generates the music, ambience, babble voices and sound effects with WebAudio.
- `src/ui.js` and `src/style.css` hold the interface.
- `src/guide.js` handles wayfinding (beacon, trail, edge arrow, phone-map route) and Bea's walk to work.
- `src/games/` holds the mini-games: `kit.js` (the shared frame, pace, pause and skip, and the room modifiers), `sort.js`, `stamp.js`, `blueprint.js` (the zoning sketch and the plain note), `pond.js`, `paint.js` and `feed.js`.

## Testing
URL parameters for local runs: `?test=1` (lighter rendering), `fast=1` (fast time, instant text), `mgslow=1` (mini-games at normal speed inside a fast run), `mute=1`, `seed=N`, `fixedstep=1` (nothing advances by itself; `window.__wb.step(n)` advances the game, the open task and the 3D render by exactly n frames of 1/60 s).

- `python3 test/play.py <fixer|blender|asker|leaver|random> <seed> <sens|std|lively> [wheels] [screenshot-dir|-] [mobile]` plays a whole season in headless Chromium and prints a JSON summary.
- `python3 test/ui_tour.py` screenshots the phone, a hint, the council and the festival.
- `python3 test/audio_smoke.py` runs with sound on and checks the audio engine.
- `python3 test/flash.py [sort] [stamp] [works] [outdoor]` is the photosensitivity check (WCAG 2.3.1): it steps the game one frame at a time for a light-sensitive player, measures each frame in a 6 by 6 grid, and fails if any tile has more than 3 general flashes in a second. It takes several minutes per scenario.
- `python3 test/mg.py [mobile] <sens|std|lively>` plays the two Works tasks with real pointer input; `test/visit.py`, `test/bp.py`, `test/pond.py`, `test/pond2.py`, `test/paint.py`, `test/feed.py` and `test/people.py` cover the visitor choice, the sketches, the pond, painting, the feed and the People guide; `test/faces.py` checks portrait framing on a phone.

Headless Chromium renders with SwiftShader, so run at most two seasons in parallel on an 8 GB machine.

## Known gaps
- No human playtests yet. Run the five-person cold test ("what was that about?") before adding content.
- Mini-game timing and difficulty were tuned in headless SwiftShader at 2 to 10 frames a second; check them on real phones and laptops.
- A focused scripted player can build all six fixes. Test with real players before tuning.
- Audio and performance have only been checked in a headless browser.
- Each resident has three or four short conversations; a release needs more writing and the Korean translation.

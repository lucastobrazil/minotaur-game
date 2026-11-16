# Colour Quest

Charlie's game (see README for the idea and controls). Prototype stage: one player, one village, four quests.

## Notes
- Look: paper-white world, black ink outlines (`shape()` adds edges or an inverted-hull outline), and colour only where it's been found or restored. Keep colour rare and vivid; that contrast is the point.
- A mesh's `userData.paint` is the colour it gets back (quest targets when helped, everything in the finale).
- Ground colour is drawn by a shader from up to 96 splats (`addSplat`); the oldest splat is dropped past that.
- Camera is a Zelda-style follow camera (`update` in `game.ts`): it trails behind, swings round lazily, and hides trees/rocks/lamps that block the view.
- Three.js is the latest version here (not r128 like The Minotaur).
- Uses `kit/players` for controllers; A (button 1) talks or jumps.

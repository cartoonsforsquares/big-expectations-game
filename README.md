# Big Expectations Game

Inspired by the Olivia Rodrigo and Chappell Roan song Expectations, I made a silly goofy game where you beat up Loser Dudes.

Play it: https://cartoonsforsquares.github.io/big-expectations-game/

- Pick **Olivia** or **Chappell** on the opening screen.
- Loser Dudes walk in from both sides. She always turns toward the closest one, and a bouncing arrow marks him; it turns yellow when he's close enough to hit.
- **PUNCH** sends that dude flying. **KICK** reaches further and knocks every dude on that side apart, but takes longer to recover from.
- A dude who reaches her costs a heart. Three hearts, and the dudes get faster with every KO. Best score is saved per character on your device.
- Keyboard: Z / J punch, X / K kick.

## Art

- `Exports/` (not uploaded): the original cut-outs: standing, punching and kicking frames for both, Loser Dude, his flipped version and his parts sheet, and the background.
- `assets/`: trimmed WebP copies the game loads, plus `manifest.json` (where each character's feet are, how far each frame reaches, and where the dude's hips are).
- `tools/make_game_assets.py` rebuilds `assets/` from `Exports/`. The Loser Dude's head, shirt, arms and hands stay one piece; only his legs swing.

## Run it

```bash
python3 -m http.server 8743
```

Then open http://localhost:8743.

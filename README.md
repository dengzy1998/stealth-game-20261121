# stealth-game-20261121

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/dengzy1998/stealth-game-20261121/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/dengzy1998/stealth-game-20261121/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

SHADOWLINE is an original top-down stealth game written in plain JavaScript and canvas 2D, with no external assets. You are Wren, a thief pulling three heists — the Marble Museum, the Gilded Casino and the Sky Gallery. Slip past vision cones that are raycast-clipped by walls and smoke, mind the noise your footsteps make, hide in bushes and dark floor, and grab the target before the exit opens. Guards patrol waypoints and their suspicion climbs while you are in their cone (faster up close, in light and while sprinting; slower in shadow and while sneaking); a curious guard walks over to look ("?"), a fully alert one raises the alarm and chases ("!"). Thirteen guards, two of them elite Wardens with wider cones and sharper eyes, stand between you and the loot. Between heists you pick one of three gadgets — Soft Boots, Smoke Pellet, Shadow Cloak, Swift Step, Keen Eye or Greased Palm — and banked loot buys permanent gear in the hideout. Score is loot plus a time bonus, a $500 ghost bonus for never being spotted and a $300 clean sweep; get caught and the heist is blown. Synthesized WebAudio sound, a minimap, a live visibility readout and a HUD tracking alarm, loot, timer, score and smoke round out the job.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. The game is fully static: everything it loads lives under `game/`, and it makes no network requests. You can also open `game/index.html` directly, and `game/index.html?shot=play` (or `title`, `upgrade`, `win`) stages a screenshot scene.

---

<sub>Entered on [make.fun](https://make.fun/?ref=01wh7qnm&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>

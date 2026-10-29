# Medici Builder

A mobile-first city builder set in Renaissance Florence, built with three.js. It has no build step and no external assets: every building is procedural low-poly geometry.

## Run

Serve the folder over HTTP (ES modules don't load from `file://`):

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

On a phone, open the same URL over your LAN, or host the folder anywhere static (GitHub Pages works). Progress saves to `localStorage`, and the city keeps earning while you're away (up to 8h).

## The loop

1. **Build.** Homes give citizens, who pay tax and staff workplaces. Farms feed them. Chapels and beauty keep them happy.
2. **Place cleverly.** This is where the creativity is. Streets give +10%. Markets, granaries, banks, dye works, mills and libraries boost their neighbours. Workshops inspire each other. Quarries and dye works are ugly. Gardens, cypresses, fountains and statues raise beauty, and beauty raises the taxes of nearby homes. A heat map and a radius preview appear while you place.
3. **Tap bubbles.** Buildings periodically offer a bonus. Rare gold ⭐ bubbles pay 6×.
4. **Fulfil commissions.** Patrons (the Priori, Cosimo, Ficino, …) send three rolling goals with rewards. The first eight form a tutorial.
5. **Research.** Spend Ingegno 💡 in a 36-node tech tree: 6 branches (Commerce, Guilds, Land & City, Faith, Humanism, Engineering) × 6 tiers, with cross-branch prerequisites. After that, Mecenatismo is an endless +5%-per-level sink.
6. **Advance eras.** Art 🎨, wonders, research and upgrades give Prestige ⭐. That moves you through Trecento → Early Quattrocento → High Renaissance → Medici Golden Age, and each era opens deeper research tiers.
7. **Raise the 10 wonders.** Orsanmichele, Santa Croce, the Baptistery, Giotto's Campanile, Ponte Vecchio, Palazzo Medici, the Uffizi, the Duomo, Palazzo Pitti and Leonardo's studio. Building all ten wins the game, and you can keep playing as a sandbox.

Upgrades (★→★★★) add floors and output. Each copy of a building costs more than the last (per-category growth), which favours upgrading and specialised districts over spam.

## Controls

| | Touch | Mouse / keys |
|---|---|---|
| Pan | drag | drag, WASD |
| Zoom | pinch | wheel |
| Rotate | two-finger twist, ⟲ ⟳ buttons | right-drag, Q/E |
| Place | tap; drag to paint streets and gardens | click / drag |
| Rotate building | ⟳ in the placing bar | R |

## Code

- `src/data.js`: resources, 40 buildings, 36 techs, eras (all the tuning lives here)
- `src/game.js`: simulation, adjacency bonuses, commissions, save/offline (no rendering)
- `src/models.js`: procedural vertex-coloured models, merged into one geometry per building
- `src/render.js`: terrain, Arno, walls, countryside, ghost/heat-map overlays, bubbles, walking citizens, boats
- `src/ui.js`, `style.css`: HUD, build drawer, inspector, tech tree, commissions, modals
- `src/main.js`: input gestures and wiring
- `vendor/three.module.min.js`: three.js r170 (MIT)

The debug handle `window.medici` exposes `{ game, world, ui, app }`.

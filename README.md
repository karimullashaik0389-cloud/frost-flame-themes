# Frost & Flame — Themes Preview

**Preview only.** Separate from the live Emergent site (`https://hackney-stone.emergent.host`).

Seven dining-mood themes, chosen by the entry tree, restyle colours / fonts / accents / games skins on a pixel-identical local copy of the Emergent site (plus the earlier tree, float menu, books, Scoop Sort, Snake, quiz, Truth or Dare additions).

## Themes

| id | Mood |
|---|---|
| `solo_m` | Just you (him) — playful comic flames |
| `solo_f` | Just you (her) — stylish blush & lilac |
| `friends` | Two friends — bright teal & sunny yellow |
| `couple` | Couple — romantic wine-red date night |
| `gang` | The Gang's Night Out — neon night street |
| `family` | Big Family Feast — marigold gold |
| `family_kids` | Family with kids — sky / grass / coral |

Deep link: `?group=solo_m` (or any id). Fresh tree: `?fresh=1`.

## Local

```bash
PORT=45116 node server.mjs
# open http://127.0.0.1:45116/?fresh=1
```

## GitHub Pages

The live website is at https://frostandflamee.com/ (files in `site/`). This themes preview home is kept at https://frostandflamee.com/preview.html; its inner pages still load through `404.html`.

Live Emergent site and `/workspace/emergent_site_copy/` are never modified by this project.

# Frost & Flame — official site (this folder)

This is the professional static website for Frost & Flame. It lives in the `site/` folder so the theme previews at the repo root stay untouched.

**Live URL:** https://karimullashaik0389-cloud.github.io/frost-flame-themes/site/

Menu items, prices, allergens, hours, the WhatsApp number and delivery areas come from the live menu data. Do not invent dishes or prices here.

## Swap a dish photo

Every dish starts with a branded placeholder tile (icy blue for desserts and cold drinks, fire tones for pulao, chaats and hot food). To drop in a real photo later:

1. Add the image to `img/dishes/`, for example `img/dishes/pani-puri.jpg`. Use a reasonably small file (under about 300 KB, `.webp` or `.jpg`, around 1200 px wide).
2. In `data/menu.json`, find that dish and set its `"photo"` field:

```json
"photo": "img/dishes/pani-puri.jpg"
```

3. Leave `"photo": null` on any dish that still needs a picture. The placeholder will keep showing, and is designed to be swapped without a redesign.

The same file is also where you update **prices**, **descriptions**, **allergens** and **sizes**. After editing, refresh the site (a hard refresh if the browser has cached the JSON).

## Local preview

From this folder:

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173/

## Custom domain

When the site is ready, point the domain at GitHub Pages for this repository, and set the site to be served from `/site/` (or move these files to the repo root). DNS changes happen at the domain registrar.

## What this site does not include yet

- Real owner dish photos (placeholders are used until those arrive)
- Reviews (the kitchen is not open yet — none are invented)
- Instagram or TikTok links (those fields are empty in the source data)
- An admin or CMS page — edits are made in `data/menu.json`


## Features on this site

The homepage also includes a Frost/Flame look (with snowfall or rising flames), a dining-mood picker, Frosty and Flamey (menu assistants, not people), the Flavour Matchmaker, Build Your Stone, an Ice-to-Fire dial, Mix one of each, a short quiz and puzzles, and meal-plan requests on WhatsApp.

Real dish photos currently in `img/dishes/` are used automatically when `photo` is set in `data/menu.json`. Other dishes keep a branded placeholder until a photo is added.

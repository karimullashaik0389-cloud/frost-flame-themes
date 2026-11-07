# Biryani / Pulao size prices (preview)

All Pulao dishes (including Gongura specials) now have a size structure:

- **Single** — set to the current single-portion price
- **Medium** — empty (`null`) until you set a price
- **Large** — empty until you set a price
- **Family Pack** — empty until you set a price

## Where to enter prices (this preview repo)

Edit `/api/menu.json` (and copy to `/api/menu`) on the `frost-flame-themes` preview:

1. Find the dish in `items` (e.g. `mutton-pulao`).
2. Update **both**:
   - `size_plan` — full list of four sizes (this is the source of truth)
   - `sizes` — only sizes with a real number price (what the menu UI shows)

Example after you set Medium = £14.99:

```json
"size_plan": [
  { "name": "Single", "price": 9.99 },
  { "name": "Medium", "price": 14.99 },
  { "name": "Large", "price": null },
  { "name": "Family Pack", "price": null }
],
"sizes": [
  { "name": "Single", "price": 9.99 },
  { "name": "Medium", "price": 14.99 }
]
```

Unpriced sizes stay hidden from the size picker until you add a number.

## Live site / QR admin

This preview does **not** write to the live Emergent admin or the QR master.
When you are ready to go live, copy the same `size_plan` / `sizes` into the live menu admin (or ask to promote this preview).

There are currently **no Biryani** dishes in the menu data — only Pulao. When Biryani items are added, give them the same four-size structure.

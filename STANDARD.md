# Jonesco app standard

How every iOS, iPad and Mac app is laid out, documented and published to
dev.jonesco.com. Existing apps are brought into this shape; new apps start in it.

Each app and each website is its own repo. `~/Developer` is a plain folder,
not a repo. This repo (`jonesco/jonesco-dev`) holds this standard, the hub site and
the list of apps. It does not hold app code.

---

## 1. An app repo

```
<app>/
├── PROJECT.md              what it is, spec, non-goals, where to look
├── dev.json                what the hub reads (section 3)
├── <App>.xcodeproj         at the root, never nested
├── <App>/                  source
├── Tests/
├── AppStore/
│   ├── Metadata.md         name, subtitle, keywords, description, review notes
│   ├── Screens/            final upload images
│   └── (capture and render scripts, templates)
└── style/
    ├── tokens.json         source of truth for color, type, spacing, radius
    ├── notes.md            open issues, decisions, rules for use
    └── screens/            real captures from the running app
```

Generated, never edited by hand: `style/index.html`, `style/STYLE_GUIDE.md`.

Rules:
- The Xcode project sits at the repo root. No `AppNameMac/` wrapper folder.
- No build output, zips or archives in git (`build/`, `*.zip`, `DerivedData`).
- A color, type or spacing change updates `style/tokens.json` in the same commit.
- Real screenshots come from the simulator or app window, not redrawings.

---

## 2. `PROJECT.md`

The context a new session starts from. Keep it under two pages.

1. **What this is.** Two or three sentences: the app, who it is for, what it is not.
2. **The app.** Platforms, minimum OS, stack (SwiftUI, SwiftData and so on), bundle ID.
3. **The product spec.** Features and rules as they work today.
4. **Non-goals.** What it will not do.
5. **Build and run.** The exact commands, including tests.
6. **Where to look next.** Pointers to `AppStore/Metadata.md` and `style/`.

---

## 3. `dev.json`

```json
{
  "name": "Buy↓Sell↑Hold",
  "slug": "buysellhold",
  "platforms": ["iPhone", "iPad"],
  "version": "1.3",
  "repo": "jonesco/buysellhold",
  "style": "style",
  "summary": "Watchlist that signals when a price crosses your own low or high."
}
```

The hub reads this and nothing else to list the app. `slug` becomes the URL:
`dev.jonesco.com/<slug>/`.

---

## 4. `style/tokens.json`

One file per app. Values only; the generator decides how to draw them.

```json
{
  "name": "Buy↓Sell↑Hold",
  "typeface": { "family": "Work Sans", "weights": [400, 500, 600, 700] },
  "color": {
    "buyGreen": { "hex": "#16A34A", "role": "Buy signal, gain", "group": "Brand" }
  },
  "type": {
    "title": { "weight": 700, "size": 24, "role": "Wordmark" }
  },
  "spacing": [4, 8, 12, 16, 24],
  "radius": { "default": 8 },
  "border": { "default": "1pt, secondary at 0.3" },
  "shadow": { "card": "#161616 at 0.08, blur 4, y 2" }
}
```

- Every color has `hex`, `role` and `group` (Brand, Text, Surface, Dark sheet).
- Name colors for their job (`surfaceDark`, `secondaryText`), not their look.
- A color with no role is not added.
- Each token name matches the name in the Swift code.

`style/notes.md` holds what the tokens cannot say: decisions and why, open
issues, and which gray to use where.

---

## 5. The hub (`jonesco/jonesco-dev`)

```
jonesco-dev/
├── STANDARD.md      this file
├── apps.json        one line per app
├── build/           generator: tokens.json → style pages, plus the index
└── site/            Jonesco System chrome (pinned design.jonesco.com version)
```

`apps.json`:

```json
[
  { "slug": "buysellhold", "repo": "jonesco/buysellhold", "ref": "main" }
]
```

- `ref` pins a branch, tag or commit. Pages publish only when `ref` moves.
- A GitHub Action checks out each repo, reads `dev.json` and `style/`, builds the
  pages and deploys them to dev.jonesco.com.
- The page chrome uses the Jonesco System stylesheet. The swatches and component
  drawings use the app's own tokens and never the Jonesco ones.

---

## 6. Adding an app

1. Create the repo in the standard layout, from the template.
2. Fill in `PROJECT.md`, `dev.json` and `style/tokens.json`.
3. Add one line to `apps.json` in this repo.
4. Push. The hub rebuilds.

---

## 7. Changing an existing app to fit

1. Move the Xcode project to the root.
2. Add `PROJECT.md` and `dev.json`.
3. Read the colors, type and spacing from the code into `style/tokens.json`.
4. Add `style/notes.md` with the open issues.
5. Remove build output and zips from git.

---

## 8. Style rules (all apps)

- American spelling.
- A bordered element gets a radius only where the app's own style does.
- Every color is a named token in code. No hex values typed into views.
- Text must reach 4.5:1 contrast on its background; 3:1 for large text and icons.
- Update `style/notes.md` when a decision is made, with the reason.

---

## 9. Status

| App | Repo | In standard shape |
| --- | --- | --- |
| Buy↓Sell↑Hold | `jonesco/buysellhold` (private) | Mostly. Has `PROJECT.md`, `dev.json`, `style/`. Still missing `AppStore/Metadata.md`; Builds, PSDs, zips and rendered videos are now ignored. Pushed on the `ipad` branch; not yet merged to main. |
| Flatbed | `jonesco/flatbed` (private) | Yes. Has `PROJECT.md`, `dev.json`, `style/`, `AppStore/Metadata.md`. Layout flattened so the repo is the project root. Pushed to main. |
| Artifactr | `jonesco/artifactr` (private) | Mostly. Has `PROJECT.md`, `dev.json`, `style/`. Missing `AppStore/Metadata.md`. Pushed to main. |

---

## 10. Generating a style guide

```sh
node build/generate.mjs <app>/style <out-dir>
```

Reads `tokens.json` (required), `notes.md`, `components.html`, `components.css`
and `screens/`. Writes `index.html`, `STYLE_GUIDE.md` and a copy of the screens.
No dependencies beyond Node.

- `components.html` and `components.css` are optional and hold anything drawn
  that is specific to the app (cards, sheets). The CSS carries the app's own
  color variables, so the app's colors never mix with the page chrome.
- `notes.md` uses `## ` for sections, `- ` for items, `[done]` to mark a
  resolved item and `[to decide]` to flag one.
- Contrast ratios are computed from the hex values; they are not typed in.

BuySellHold’s own `style/` folder (`jonesco/buysellhold`) is a working example of every file.

Build the whole hub locally with `node build/site.mjs --local ~/Developer`
(apps are matched to folders by the `slug` in each `dev.json`), then open
`dist/index.html`. In CI, `node build/site.mjs` clones each repo in
`apps.json`; the `APPS_READ_TOKEN` secret gives it read access to the private
ones. Pages use the Jonesco System, pinned in `build/site.mjs` and
`build/generate.mjs` (currently 3.5.0).

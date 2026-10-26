# harini chandrasekar portfolio

Static one-page portfolio for Harini Chandrasekar. Built with plain HTML, CSS, and vanilla JavaScript for GitHub Pages.

## Local Preview

Open `index.html` directly in a browser from the repository root.

No build step is required.

For a local server preview, run one of these from the repository root if available:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Folder Structure

```text
index.html
styles/
  main.css
  motion.css
  responsive.css
scripts/
  main.js
  navigation-ball.js
  project-viewer.js
  project-data.js
  landing-girl-animation.js   the landing animation (girl, walk / run, hair, timeline, scene)
  landing-girl-thoughts.js    the thought cloud (props, swirl), loaded after the first frame
assets/
  images/
    about/
    work/
    archive/
  videos/
  documents/
```

## Image Optimisation Notes

Every project image ships twice, as AVIF (small) and WebP (fallback), with the same file name. Source renders and boards are never used directly: they are resized and compressed first (a 25 MB render becomes roughly 80 to 150 KB).

Project image paths (one folder per project):

```text
assets/images/work/project-id/thumb-800.avif   thumb-800.webp     overview tile, 800 px wide, 7:5
assets/images/work/project-id/thumb-1200.avif  thumb-1200.webp    overview tile, 1200 px wide, 7:5 (default)
assets/images/work/project-id/hero-1600.avif   hero-1600.webp     viewer hero and first panel, 1600 x 1143, 7:5
assets/images/work/project-id/panel-02.avif    panel-02.webp      one "board" per later panel (panel-02 ... panel-NN): several whole pictures arranged on one dark board, the important ones larger, overall ratio about 0.95 to 1.85
```

Size budgets (AVIF): thumb-800 about 45 KB, thumb-1200 about 85 KB, hero about 150 KB, each panel about 40 to 220 KB.

How they are loaded:

- The overview tiles in `index.html` use `<picture>` (AVIF first, WebP fallback), `srcset`/`sizes`, `loading="lazy"` and fixed `width`/`height`, so nothing shifts and nothing below the fold is fetched early. A tile whose picture has not arrived yet shows its empty frame and the picture fades in (`initTileImageFade` in `scripts/main.js`).
- The project viewer (`scripts/project-viewer.js`) only requests images when a project is opened. `project-data.js` lists the `.webp` path; the script asks for the `.avif` sibling when the browser can decode it.
- Hovering, focusing or touching a tile warms the cache with the hero and panel 2, so the viewer opens quickly. Panels from the third on are requested as they come within about two screens of the visible area (`IntersectionObserver`), so a long project opens fast and only fetches what is about to be seen. A frame whose picture is still arriving shows its empty dark frame and the picture fades in.
- Panels from the third on are laid out and painted only when they come near the screen (`content-visibility: auto` in `styles/motion.css`), so a project with thirty panels opens as quickly as one with five.
- Each project popup has 6 to 12 tiles (the intro plus 5 to 11 boards), told in the order of the project's story. A board is built from several whole, uncropped pictures (plans, sections, renders, diagrams) with the most important one largest, so wide drawings are stacked rather than shown as thin strips. The frame of every board follows its aspect ratio (`ratio` = width / height in `project-data.js`) and is as tall as the screen allows.
- Pictures inside the popups are in colour. The overview tiles stay grey (`filter: grayscale(1)` in CSS): the tile's picture gains its colour as it flies into the popup and loses it again on the way back.
- The first frame of every project is cover-cropped (about 1.1:1 on a laptop, 1:1 on phones): keep the hero's subject in the central 80 %.

To add a project: create its image set in the same sizes, add an entry to `scripts/project-data.js` (title, summary, optional `meta`, then panels: the first has only `heading` and `body`; every later one has `heading`, `body`, `image`, `alt` and `ratio`) and a tile in `index.html`.

## Smoothness Notes

- The page's own scrollbar is hidden (`scrollbar-width: none` in `styles/main.css`). It used to disappear whenever a project opened and come back when it closed, which nudged the whole page and the navigation ball sideways by half a scrollbar. Scrolling (wheel, touch, keys, the navigation ball) is unchanged.
- The viewer opens and closes with one moving picture: the tile's picture flies to the first frame (the flight starts at once, it never waits for the big picture to download), the first frame is shown and the flying copy removed in the same step, and closing flies the picture back onto the tile, which is shown again in the same step the viewer is hidden. Only opacity and transform are transitioned on the content; there is no blurred backdrop.
- The soft top and bottom edges while scrolling are plain gradients (a blurred backdrop over a scrolling page froze the first scroll and cost frames on slower graphics cards). The page itself (text, paper) fades to the paper colour; pictures (tiles, archive bars, the portrait) sit above that fade and fade to black instead. Each picture carries two black gradient strips (`initImageVignette` in `scripts/main.js`, CSS next to the edge fades in `styles/main.css`); while a picture is at an edge, its strip is moved with a transform so the black stays pinned to the edge of the screen. Only a transform changes while scrolling, so it costs no repaint.
- The space between one section's content and the next section's title is about 110 px on a laptop (`--section-gap-half` in `styles/main.css`).
- The navigation ball's trips stop with the section title near the top of the screen, the first tile whole and a good part of the second visible (`LANDING_SCREEN_FRACTION` in `scripts/navigation-ball.js`); the ball's top edge always stays at least about 44 px below the top of the screen.
- Overview tiles and archive bars are promoted to their own compositor layers (`will-change: transform`) so their greyscale and rounded clip are painted once instead of every time they scroll into view.
- The landing animation's heavy reset waits until the page has stopped scrolling, and its background build waits while the landing is off screen.

## Landing Animation

- `scripts/landing-girl-animation.js` boots as soon as it runs: the first painted frame already shows her mid-stride inside the right edge (`FIRST_LOOK` in the site section). The thought cloud (`scripts/landing-girl-thoughts.js`) is requested at the same moment and only needed about 5 s later, so the first script stays small.
- The story is a pure function of time (`timeline.js` section): walk in, a hello wave, about 20 s of thinking, the ball, two looks back on the walk out, a peek. The nav `+` starts a reaction (look, take, jump, turn, run away with dust and a look back).
- Walk and run steps change length with speed (short quick steps when starting or stopping), so the planted feet never slide. Arms swing continuously; the ponytail streams along the body when she looks back.
- On fast displays the scene is drawn on every n-th refresh while a frame costs more than one refresh (`pace()` in the scene section): an even 72 fps on a 144 Hz screen instead of an uneven mix.
- Deterministic test hooks: `window.__landingGirl.scene` has `restart(t0)`, `advanceTo(t)`, `press()`, `advanceBy(s)`, `render()`.

## Deployment

This site is GitHub Pages-ready as a static root deployment.

In GitHub:

1. Open repository settings.
2. Go to `Pages`.
3. Choose `Deploy from a branch`.
4. Select `main`.
5. Select `/root`.

The site should load from the repository root because all CSS, JavaScript, and asset paths are relative.

## Custom Domain

When the final domain is ready, add a `CNAME` file at the repository root containing the domain name, then configure the same domain in GitHub Pages settings.

## Current Placeholders

- Landing video placeholder lives in the HTML/CSS only.
- The About image and the archive items are local SVG placeholders. The first five works (pause, spatial archive, rainy madras, shade, staircase) carry real project content and images (6 to 12 tiles each).
- Resume should be placed at `assets/documents/harini-chandrasekar-resume.pdf`.
- Contact form is static and shows a placeholder response.

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
assets/images/work/project-id/panel-2.avif     panel-2.webp       panels 2 to 5, 1600 x 1400 (8:7), one per panel
```

Size budgets (AVIF): thumb-800 about 45 KB, thumb-1200 about 85 KB, hero about 150 KB, each panel about 170 KB.

How they are loaded:

- The overview tiles in `index.html` use `<picture>` (AVIF first, WebP fallback), `srcset`/`sizes`, `loading="lazy"` and fixed `width`/`height`, so nothing shifts and nothing below the fold is fetched early.
- The project viewer (`scripts/project-viewer.js`) only requests images when a project is opened. `project-data.js` lists the `.webp` path; the script asks for the `.avif` sibling when the browser can decode it.
- Hovering, focusing or touching a tile warms the cache with the hero and panel 2, so the viewer opens quickly. Panels 3 to 5 load lazily and are fetched in the background once the first panel is on screen.
- Every image is shown in greyscale by CSS, so choose crops with strong tonal contrast, and keep the subject in the central 80 % (images are cover-cropped into frames from 0.94:1 to 1.25:1, and 1:1 on phones).

To add a project: create its image set in the same sizes, add an entry to `scripts/project-data.js` (title, summary, optional `meta`, five panels with `heading`, `body`, `image`, `alt`) and a tile in `index.html`.

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
- The About image and the archive items are local SVG placeholders. The first five works (pause, spatial archive, rainy madras, shade, staircase) carry real project content and images.
- Resume should be placed at `assets/documents/harini-chandrasekar-resume.pdf`.
- Contact form is static and shows a placeholder response.

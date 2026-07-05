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

Work overview images should use thumbnails, not full project renders.

Recommended project image paths:

```text
assets/images/work/project-id/thumb-1200.webp
assets/images/work/project-id/thumb-1600.webp
assets/images/work/project-id/hero-2200.webp
assets/images/work/project-id/process-01.webp
```

Use `thumb-1200.webp` as the default overview image and add `srcset` with `thumb-1600.webp` once real assets exist. Keep `width`, `height`, and CSS `aspect-ratio` values to prevent layout shift.

Project detail images should be loaded only when project focus mode opens. The current prototype already sets the focus image from JavaScript on demand.

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
- Work and About images are local SVG placeholders.
- Resume should be placed at `assets/documents/harini-chandrasekar-resume.pdf`.
- Contact form is static and shows a placeholder response.

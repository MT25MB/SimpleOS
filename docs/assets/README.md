# Brand assets

Two small, committed images live in this folder. Both use the slate palette (`#0B1120` / `#1E293B`) with off-white text, so they blend into the site without a visible box around them.

| File | Size | Purpose |
| --- | --- | --- |
| `simpleos-logo.png` | 512 x 512, about 203 KB | 1:1 logo for the site header and the app header |
| `simpleos-banner.png` | 1240 x 600, about 511 KB | Wide banner for the README and the site intro |

Both are under 1 MB. Please keep them that way.

## Saving a new version

Export from your editor as PNG with a transparent or slate background, then compress before copying anything into this folder. With ffmpeg:

```sh
# 1:1 logo
ffmpeg -y -i "SimpleOS Logo.png" \
  -vf "scale=512:512:flags=lanczos" \
  -c:v png -compression_level 9 docs/assets/simpleos-logo.png

# 1240x600 banner
ffmpeg -y -i "SimpleOS Banner.png" \
  -vf "scale=1240:600:flags=lanczos" \
  -c:v png -compression_level 9 docs/assets/simpleos-banner.png
```

Check the result before committing:

```sh
ls -lh docs/assets/*.png        # each file must be under 1 MB
file docs/assets/*.png          # confirm 512x512 and 1240x600
```

If a file is still too large, lower the PNG compression level trade-off by switching to a palette PNG, or export at a smaller size and let CSS scale it down. Do not commit a multi-megabyte master.

## Keep temporary files out of Git

The two original PNGs at the repository root are the source exports this folder was made from. Keep future masters and scratch exports in a folder outside the repository. Large source formats such as PSD, AI, XCF, Figma and Sketch files, plus `assets-src/` and `artwork/`, are ignored in the root `.gitignore`, so they will not be staged by accident. Only the two compressed PNGs above belong in this folder.

## Self-hosted fonts

`assets/fonts/` holds four WOFF2 files: Atkinson Hyperlegible 400 and 700, and the variable JetBrains Mono and Plus Jakarta Sans faces. They are served from our own origin so the site makes no third-party requests. All four are published under the SIL Open Font License 1.1 by Google Fonts; keep that licence notice with the files if they are replaced.

## Using the images

- The logo is decorative when the wordmark sits next to it, so give the image tag an empty `alt` attribute.
- The banner carries a title and three feature lines, so describe it in `alt` text rather than leaving it empty.
- Always set `width` and `height` attributes, or a CSS `aspect-ratio`, so the browser reserves the right space and the image never stretches.

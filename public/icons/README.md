# App icons

`favicon.svg` is provided. You still need three PNGs for the PWA/home-screen:

- `icon-192.png` (192×192)
- `icon-512.png` (512×512)
- `icon-maskable-512.png` (512×512, with safe padding for maskable)

Easiest ways to generate them from `favicon.svg`:

```bash
# with ImageMagick
magick -background none favicon.svg -resize 192x192 icon-192.png
magick -background none favicon.svg -resize 512x512 icon-512.png
cp icon-512.png icon-maskable-512.png   # add ~12% padding for a true maskable

# or with sharp (node)
npx sharp-cli -i favicon.svg -o icon-512.png resize 512 512
```

Or drop `favicon.svg` into https://realfavicongenerator.net and export.
The app still works without the PNGs — only the installed-icon look is affected.

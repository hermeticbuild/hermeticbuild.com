# Hermetic Build website

The site is plain HTML, CSS, and JavaScript. Its entry point is `website/index.html`.

Run the local server with Python 3:

```sh
python3 scripts/preview.py
```

Open [the live preview](http://127.0.0.1:8765/website/). The browser reloads when files under `website/` change.

To publish, select **GitHub Actions** under **Settings → Pages → Build and deployment**, then run **Deploy website to GitHub Pages** from the Actions tab. Later changes to `website/` on `main` deploy automatically.

# Tabbed Word

Live version: https://tabbedword.pages.dev/

A browser-based word processor with tabs. Open, edit, save and export DOCX, ODT, TXT, MD and HTML files.
Everything runs on your device; files are never uploaded. Works offline after the first visit, with spellcheck
dictionaries cached locally.

## Features

- Several documents open at once, each in its own tab.
- Save writes back to the same file where the browser supports it (Chromium-based browsers on desktop); otherwise it downloads.
- Side-by-side view, outline view, comments and notes, page layouts (A4 and Letter).
- Spellcheck with Hunspell dictionaries (see the `spell` folder).
- Export to PDF and send all open documents by email (setup in `EMAIL-SETUP.txt`).

## Running it

Serve the folder with any static web server, or open `index.html` in a supported browser. Hosting on a
static service such as Cloudflare Pages or GitHub Pages works without changes.

## Licence

MIT. See `LICENSE`. Third-party components and their licences are listed in `third-party-licenses.txt`.

## Author

The Last Byzantine.

This project is not affiliated with or endorsed by Microsoft. "Word" and "DOCX" are trademarks of their owners.

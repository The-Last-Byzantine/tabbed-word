# Tabbed Word

**Live version:** https://tabbedword.pages.dev/
**Other apps and landing page:** https://tabbedapps.pages.dev

Tabbed Word is a word processor that runs in the browser, with each document in its own tab and a look based on Word 2003 (the Windows XP "Blue" colours, the classic menu row and the beige status bar). You can open, edit, save and export DOCX, ODT, TXT, Markdown and HTML files, and open old Word 97–2003 (.doc) files to read and edit.

**Version 2026.11.80:** Open from Google Drive also opens files whose Drive name has no ending (for example a Word file called just "Report"). The format is taken from Drive's file type, and saving keeps the Drive name unchanged.

**Version 2026.11.79:** Google Docs. Open from Google Drive now lists Google Docs too; a Google Doc opens in a tab as a Word document, and Save to Google Drive (and the automatic sync) writes the edits back into the same Google Doc, with the same name and link. File › Save as Google Doc turns any open tab into a new Google Doc that then stays in step. If someone changes the Google Doc in Google Docs meanwhile, the app does not overwrite it silently. Google's conversion keeps text, headings, lists, tables, images, footnotes and comments; layout details can shift slightly, as with any Word-to-Google Docs conversion.

**Version 2026.11.78:** Google Drive uses the narrower `drive.file` access: the app sees only files it created and files you pick in Google's file picker. Open from Google Drive opens that picker, sized to fit the window (also in Safari). The site now sends only its own address to other sites (`strict-origin-when-cross-origin`), which the picker's website-restricted key needs. New setting under Writing: "Capitalise the first letter of each sentence" (on by default; also works in Safari and in the paged view).

Everything runs on your device. Your files are never uploaded. The app works offline after the first visit, and spellcheck dictionaries are cached locally.

---

## Contents

1. [Quick start](#quick-start)
2. [Tabs and several documents](#tabs-and-several-documents)
3. [Saving, opening and exporting](#saving-opening-and-exporting)
4. [The folder panel](#the-folder-panel)
5. [Editing](#editing)
6. [Review: track changes, comments and notes](#review-track-changes-comments-and-notes)
7. [References and citations (Zotero)](#references-and-citations-zotero)
8. [Views and layout](#views-and-layout)
9. [Status bar](#status-bar)
10. [Running it yourself](#running-it-yourself)
11. [Browser support](#browser-support)
12. [Licence and credits](#licence-and-credits)

---

## Quick start

1. Open https://tabbedword.pages.dev/ in Chrome, Edge, Brave, Firefox or Safari.
2. Choose **New** for an empty document, or **Open** to load a file from your computer.
3. Write. Your work is kept as a draft on this device as you type, so a closed tab can be restored.
4. Save with **Save**, or export with **Save As**, **Export PDF** or **Email**.

On Chrome and Edge the app can write back to the same file you opened. On other browsers it downloads a copy (see [Saving, opening and exporting](#saving-opening-and-exporting)).

---

## Tabs and several documents

- Each document opens in its own tab. Click a tab to switch; the close cross on a tab closes only that document.
- **Save all & close** saves every open document and closes its tab. In Chrome and Edge the files are written back in place. In other browsers each document is downloaded one after another, and then the tabs close.
- **Discard all** closes every tab and deletes the drafts. It asks first.
- **Split at cursor** cuts the document in two at the cursor. The part after the cursor opens in a new tab, and styles, bold, italic, footnotes and comments stay with their text.
- Drafts are kept on the device, so if the browser closes or crashes you can restore them from **Backups and drafts** (Tools menu).
- If the same workspace is open in a second window, the app warns you, because two windows can overwrite each other's drafts.

---

## Saving, opening and exporting

| You want to | Chrome and Edge (desktop) | Brave, Safari, Firefox |
|---|---|---|
| Open a file | Choose the file; it stays linked | Choose the file; a copy is loaded |
| Save | Writes back to the same file | Downloads a copy |
| Save As | Chooses a new file | Downloads under the name you give |
| Save all & close | Writes every tab and closes it | Downloads each tab, then closes it |

**Formats:**

- **Open:** DOCX, ODT, TXT, Markdown (.md), HTML (.html, .htm) and Word 97–2003 (.doc, bold and italic are read).
- **Save / Export:** DOCX, ODT, TXT, Markdown, HTML.
- **Export PDF:** opens your browser's print dialogue for the document; choose "Save as PDF" there.
- **Email all:** puts every open document, as a DOCX file, into one new draft in your Outlook/Microsoft 365 or Gmail account, with the files attached. You review and send the draft yourself. Setup is in `EMAIL-SETUP.txt`.

Files are never sent to a server by the app itself. The only network use is loading the app and its dictionaries, plus the mail service when you use Email all.

---

## The folder panel

The **Folders** tab sits on the left of the window. Open it to see the Word, ODT, TXT, Markdown and HTML files in a folder you choose.

- **Chrome and Edge:** choose a folder once. The browser remembers it, and after a restart it asks you to allow access again. You can open, edit and save files in place, and a Zip archive can be unzipped into the folder.
- **Brave, Safari and Firefox:** the browser does not allow the app to keep write access to a folder, so the panel is read-only. Opening a file works; use **Save As** to write a changed copy.
- Use **Show folder panel** and **Hide folder panel** in the View menu, or click the Folders tab to collapse it.

The panel is hidden on narrow screens and phones.

---

## Editing

- **Ribbon and menu bar:** the Office 2003 layout. Home, Insert, Review, Session and About are tabs above the ribbon; the classic menu row (File, Edit, View, Insert, Format, Tools, Table, Window, Help) is above that.
- **Formatting:** fonts, sizes, bold, italic, underline, highlight, alignment, lists, styles and paragraph spacing and indents (Format > Paragraph).
- **Tables:** insert tables, add and delete rows and columns, merge and split cells, and set borders.
- **Pictures and objects:** pictures from Word files and inserted images are kept when you save.
- **Find and replace, spelling and grammar:** Spelling and Grammar uses Hunspell dictionaries (see the `spell` folder). Consistency check looks for inconsistencies in the text.
- **Word count:** click the word count in the status bar for a fuller analysis.
- **Keyboard:** the usual Word shortcuts work, including Ctrl+Z and Ctrl+Y for undo and redo.

---

## Review: track changes, comments and notes

- **Track changes** (Tools menu, or Ctrl+Shift+E) records insertions and deletions with the author name. The Accept and Reject commands work on all changes, or only the one at the cursor. Exports leave out deleted text.
- **Comments:** add a comment to selected text, reply to it, resolve it or delete it. Comments are kept in DOCX files.
- **Footnotes:** Insert > Footnote adds a numbered footnote. Footnotes are written to DOCX files as real Word footnotes.
- **Hyperlinks:** select text and press Ctrl+K, or use Insert > Hyperlink…, to add, edit or remove a link. Ctrl+click opens it. Links are written to DOCX and ODT files and read back from DOCX files; Undo restores them.
- **Cite** (Tools menu, and the Review tab): inserts a citation from a BibTeX key. This is the original citation tool and is separate from References.

---

## References and citations (Zotero)

Tools > **References…** opens the reference manager. It works with Zotero, but it does not connect to Zotero directly. Zotero and Tabbed Word exchange data through a file:

1. **In Zotero:** select the items you need (or your whole library), then choose **Export** and pick **CSL JSON** as the format. Save the file.
2. **In Tabbed Word:** open References… and choose the file. You can choose several files; their items are merged into one library.
3. **Choose the citation style:**
   - **APA 7th edition** (official CSL style).
   - **Chicago author-date** (official CSL style).
   - **Chicago 18th full note (footnotes):** each citation is inserted as an automatic footnote. The first note for a source is the full note, later ones are shortened, and the bibliography is added at the end.
   - **Temporary placeholders (for Word + Zotero):** see below.
4. **Insert citations:** click a reference in the list. It is inserted at the cursor (in the body text, or as a footnote in the Chicago note style). Citations stay linked to their source, so changing the style later reformats them, and changing the style again converts them back.
5. **Build the reference list:** tick the references you want in the list (or leave all unticked to list only the references you cited), then choose **Insert References list**. Italic titles and journal names are kept.
6. **Manage the library:** remove one imported file, remove the ticked items, or clear the whole library. Removing a source does not remove citations already in the text.

**Temporary placeholders (for Word + Zotero):** this style writes each citation as a marker such as `{{cite:smith2020|(Smith, 2020)}}`, which you can find and replace in another program. Use **Export list (CSL JSON)** to save the references you need, import that file into Zotero (File > Import), and then, in Word with the Zotero plug-in, replace each marker with a Zotero citation. The Zotero plug-in step is manual; Tabbed Word does not write Zotero fields.

**Limits:** Zotero is not connected live, so new items must be exported again. The app uses the official CSL styles, and their output is plain text with italics for titles and journals in the body and in Word footnotes.

---

## Views and layout

- **Page view:** A4 or Letter pages, with page breaks shown as the document is typed.
- **Continuous text:** one long page with no page breaks, which is easier for drafting. Columns (one to three) work in this view and in DOCX files.
- **Side by side:** two documents shown next to each other.
- **Outline view:** the document as an outline of its headings and paragraphs; you can move and promote sections.
- **Paragraph view and focus mode:** hide the ribbon and tabs to concentrate on the text.
- **Full screen:** press Esc to return.
- **Zoom:** in and out from the View menu or the status bar.

---

## Status bar

The status bar at the bottom shows:

- The file state: whether the document is saved to a file or is a draft on this device.
- The page count, word count and position of the cursor (line and column).
- Zoom, and the spelling indicator.

---

## Running it yourself

Serve the folder with any static web server, or open `index.html` in a supported browser. Hosting on a static service such as Cloudflare Pages or GitHub Pages works without changes.

```
npx serve .
```

The service worker (`sw.js`) caches the app for offline use. Bump its cache name when you change files, so browsers pick up the new version.

---

## Browser support

- **Chrome and Edge (desktop):** full support, including writing back to files and the folder panel with write access.
- **Brave, Safari and Firefox:** all editing and export features. Saving downloads a copy, and the folder panel is read-only.
- **Phones and tablets:** editing works; the folder panel is hidden.

---

## Licence and credits

MIT. See `LICENSE`. Third-party components, including Hunspell dictionaries, citeproc-js (CPAL/AGPL) and the Citation Style Language styles and locales (CC BY-SA 3.0), are listed in `third-party-licenses.txt`.

## Author

The Last Byzantine.

This project is not affiliated with or endorsed by Microsoft. "Word" and "DOCX" are trademarks of their owners. Zotero is a trademark of the Corporation for Digital Scholarship.

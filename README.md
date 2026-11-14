# TabbedWord 2026.11.82

Deploy the contents of this folder to your static host. The `chrome-duck-bridge` folder is the companion browser extension, not part of the site.

The document stays in a centered column between symmetric left and right shoulders. Each shoulder has its own show/hide control at its upper-right. Both contents start collapsed; controls and shoulder space remain. Showing either side does not shift the document.

Command search, writing statistics, comments, tracked changes, TabZot references, exports, versions, local drafts, Organizer and Google Drive tools are included.

## Duck.ai helper (2026.11.82, DuckBridge 1.5.0)

Select text in the document, type a command in the Duck.ai shoulder, press Send (or Ctrl/⌘+Enter). The DuckBridge extension opens Duck.ai in a background tab, submits the command with the selected text, streams the reply back into the shoulder and closes the tab the moment the reply arrives. Review or edit the reply, then Insert into document places it below the original selection. No API key, account pairing or setup.

Install the extension from `chrome-duck-bridge/`: chrome://extensions (or brave://extensions) → Developer mode → remove older TabbedWord bridges → Load unpacked → select the folder → reload TabbedWord. Only tabbedword.pages.dev, duck.ai and duckduckgo.com have host access. Duck.ai terms or verification screens are never accepted automatically; a failed request keeps its tab open for inspection.

## What's new since 2026.11.53

- 2026.11.82: Duck.ai helper and DuckBridge 1.5.0 (background-tab operation, clean reply extraction, immediate return on Duck.ai's Copy control, tab closed on delivery, equal-height command and reply boxes, Ctrl/⌘+Enter sends).
- 2026.11.80: Info shows the current build with release history; named versions (File › Save version, Versions…); Insert › Page break and Table of contents; File › New from template; flat bottom status bar; dark theme for toolbar and ribbon.
- 2026.11.67: Mobile full-height writing page, keyboard-aware scrolling, mobile Documents & sections menu, mobile font/size/style selectors.
- 2026.11.63: Detailed ribbon pictograms; Layout page/orientation controls and Indent & spacing; View groups workspace tools.
- 2026.11.56–.59: TabZot and Comments panel (RIS/BibTeX libraries, citation picker, APA 7 / Chicago styles); screenshot-inspired ribbon; Reading font and Text size icons.
- 2026.11.55: Google open-source fonts (OFL) built in; Paste options menu.

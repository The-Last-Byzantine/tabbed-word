TabbedWord DuckBridge 1.5.0 — for TabbedWord 2026.11.82

Rebuilt on the user's proven AI Bridge 2.0.2 mechanics (Duck.ai only; DeepSeek removed), made fast:
- The page runner pulls its job from the worker and polls the page, so it works while the task tab stays in the background (no tab switch needed).
- Opens https://duck.ai/ directly; fills the textarea, clicks Send once (claimed first, never submitted twice).
- Reply read from Duck.ai's assistant-message container only; paragraphs and lists kept, word spacing preserved, sender label/model name dropped.
- Completion: Duck.ai's "Copy to clipboard" on the reply returns it at once; otherwise Stop gone + 1.5 s still, or ready composer + 6 s still (2.0.2 waited 5 s / 20 s).
- 400 ms polling, live preview streaming into TabbedWord.
- The task tab closes the moment the reply is delivered, and on Cancel. A failed request keeps its tab open so you can see the sign-in/terms/verification screen.
- 6-minute timeout. Only tabbedword.pages.dev, duck.ai and duckduckgo.com have host access. No API key.

Install: chrome://extensions (or brave://extensions) → Developer mode → remove/disable every older TabbedWord bridge → Load unpacked → select THIS folder. Reload TabbedWord (2026.11.82 checks for DuckBridge 1.5.x).

Live Duck.ai could not be reached from the build environment; selectors come from the saved Duck.ai pages used by 2.0.2.

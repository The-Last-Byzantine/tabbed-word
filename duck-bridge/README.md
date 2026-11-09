# Duck.ai bridge (Chrome / Edge extension)

Lets the Duck.ai tab in Tabbed Word send a question to duck.ai and bring the answer back into Tabbed Word.

## What it does

- Tabbed Word posts your question to the extension.
- The extension opens **one** duck.ai tab in the background (it does not take focus) and reuses that same tab for every later question.
- It puts the question into duck.ai, presses send, and waits until the answer has stopped changing.
- It sends the answer back to the Tabbed Word tab, which shows it in the Duck.ai tab, where it can be copied, inserted into the document, or reopened from Recent.

Nothing is sent anywhere else. The extension only reads duck.ai's page while a question is waiting, and only on duck.ai. It stores the id of the duck.ai tab in session storage.

## Permissions

- `storage`: remembers the duck.ai tab id for the browser session.
- Host access to `duck.ai`, `tabbedword.pages.dev` and `localhost`: lets it read duck.ai's answer and talk to the Tabbed Word page.

## Install (unpacked)

1. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
2. Press **Load unpacked** and choose this `duck-bridge` folder.
3. Open Tabbed Word, go to the left shoulder, choose **Duck.ai** and type a question.

Without the extension, Tabbed Word still works: Send copies the question, and the window says so.

## Limits

- duck.ai's page layout can change. If answers stop arriving, the text-reading rules in `duck.js` need updating.
- The extension gives up after three minutes if no answer has appeared.

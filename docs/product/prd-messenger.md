# PRD: Direct Messenger

## Positioning shift (PM)
The user's framing: Cookzer is not a recipe app with a social layer
bolted on — it's a social network *for cooks*, the same category shape
as Facebook or LinkedIn, just vertical to cooking. That reframes the
roadmap: identity, connections, and communication between people are
core infrastructure, not add-on features. Messenger is the first piece
of that.

## Problem
Every page's header already has a 💬 icon implying messaging exists —
it does nothing. There is no way for two Cookzer users to talk directly
(e.g., asking Sarah K. for her karahi recipe details, coordinating a
challenge).

## Scope decision (PM) — build now vs. real backend
The entire site today is static HTML with hardcoded content — no
accounts, no database, nothing persists across users. A "real" messenger
(actual delivery between two different people's browsers) needs a
backend: auth, a message store, and either polling or a live connection.
That's a genuine infrastructure decision (hosting cost, stack choice)
that shouldn't get made silently while wiring up a chat UI.

Decision: ship the full messenger **experience** now, at the same
fidelity as the rest of the site (the feed's hearts/comments are also
hardcoded, not live) — a real, working two-pane inbox UI with demo
conversations, where messages you send persist locally (localStorage) so
the UI feels alive across reloads. This is not a mockup image, it's a
functioning page. Making messages actually travel between two different
people's devices is a separate, explicitly flagged follow-up
(`docs/product/ideas.md` — "Real backend") once the user decides on a
backend.

## Requirements (BA)
- New page, `cookzer-messenger.html`, reachable from: the sidebar nav
  (new "Messenger" item, all 6 pages) and the header 💬 icon (currently
  dead on all pages).
- Two-pane layout: conversation list (left) + active thread (right),
  matching the existing shell's visual language (palette, fonts, card
  style already established).
- Conversation list: avatar, name, last message preview, timestamp,
  unread indicator (bold + dot) for unread threads.
- Thread view: message bubbles distinguishing sent vs. received, sender
  avatar, a text input + send button.
- Sending a message: appends it to the thread immediately, clears the
  input, persists via localStorage so it survives a page reload.
- Selecting a conversation marks it read (unread indicator clears).
- Mobile (≤768px, matching the breakpoint already used sitewide): show
  only one pane at a time — conversation list by default, tapping a
  conversation shows the thread with a back button to return to the
  list. No horizontal overflow at 390px width.
- Sidebar/header on this page reuse the exact same responsive shell
  (hamburger drawer, overlay) already shipped — not reinvented.

## Out of scope (this iteration)
- Real-time delivery between two different users/devices
- Group chats, read receipts beyond the unread dot, message search,
  attachments/photos in messages
- Any backend/auth work

## Acceptance criteria
- From any of the 6 pages, both the sidebar "Messenger" link and the
  header 💬 icon reach `cookzer-messenger.html`.
- Selecting a conversation shows its messages and clears its unread
  state.
- Typing a message and sending it appends a new sent-bubble, clears the
  input, and is still there after a page reload.
- At 390px width: no horizontal scroll; only one pane visible at a time,
  with a working back button from thread back to the list.
- Existing pages/desktop layout unaffected other than the new nav item.

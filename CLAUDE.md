# Project Instructions

This is a web-based game.

## Requirements

- Must run in a web browser — desktop, tablet, and phone (mobile browsers).
- Use only standard web technology (HTML, CSS, JavaScript). Avoid frameworks or tools that require a build step or native app packaging unless there's a clear need.
- The game should be playable/responsive across screen sizes — no assuming a mouse/keyboard-only or desktop-only layout. Support touch input where relevant.
- The game is published via GitHub Pages (a free static site host built into GitHub — it just serves plain HTML/CSS/JS files straight from this repo, no server needed). This means:
  - No server-side code (no Node/PHP/databases, etc.) — everything has to run in the browser.
  - File paths and links must work as a static site (relative paths, correct case, no build step required unless the built output is what gets committed/served).

## Working with the user

- The user is not a software engineer. Explain things in simple, plain terms — avoid unexplained jargon. When something technical is unavoidable, briefly say what it means.
- Commit to git often (small, frequent commits), with clear plain-language commit messages.
- Always push directly to the `main` branch (no separate feature branches/PRs) — GitHub Pages serves the live game straight from this repo, so `main` should always be pushed to.

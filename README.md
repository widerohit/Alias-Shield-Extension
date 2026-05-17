# AliasShield

AliasShield is a Manifest V3 Chrome extension that generates Gmail plus-address aliases for signup forms. It runs entirely in the browser, stores data locally, and does not use external servers or tracking.

## What It Does

AliasShield helps you create site-specific Gmail aliases such as:

```text
yourname+exampledomain+20260512@gmail.com
```

If your real Gmail is `yourname@gmail.com`, messages sent to that alias still arrive in the same inbox. The extra alias text makes it easier to identify, search, filter, or block mail from a specific signup source.

## Features

- Generates valid Gmail aliases using your base Gmail address
- Extracts the current website domain automatically
- Supports alias presets and custom patterns
- Supports date tokens such as `{YYYYMMDD}`, `{YYMMDD}`, and `{timestamp}`
- Detects signup/register/create-account forms
- Avoids login/sign-in pages
- Supports dynamic React/Vue/SPA forms with `MutationObserver`
- Optional automatic signup email autofill
- Floating suggestion widget with copy, regenerate, and close controls
- Popup with current alias, copy button, refresh/regenerate icon, domain info, and recent aliases
- Disables regenerate when the selected alias pattern cannot produce a new value
- Saves copied/generated aliases into local history
- Searchable alias history
- Delete individual aliases
- Confirm before clearing all alias history
- Select aliases for export
- Export selected aliases as TXT or CSV
- Copy an aggregated Gmail block/filter query
- Enable or disable AliasShield for the current site from the popup
- Manage blacklisted domains in settings
- Import/export full JSON backup of settings and alias history
- Auto-remove old aliases after a configurable number of days
- Dark, light, and system theme support
- Chrome keyboard commands
- No analytics, no tracking, no remote backend

## Folder Structure

```text
AliasShield/
├── manifest.json
├── assets/
├── background/
│   └── service-worker.js
├── content/
│   ├── detector.js
│   ├── main.js
│   └── widget.js
├── popup/
│   ├── popup.html
│   └── popup.js
├── settings/
│   ├── settings.html
│   └── settings.js
├── styles/
│   ├── content.css
│   └── popup.css
└── utils/
    ├── domain.js
    ├── export.js
    ├── generator.js
    └── storage.js
```

## Installation

1. Clone or download this repository.
2. Open Chrome and visit:

```text
chrome://extensions
```

3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the `AliasShield` project folder.
6. Pin AliasShield from the Chrome extensions menu.
7. Open AliasShield settings and save your base Gmail address.

## Usage

1. Open the extension popup.
2. Click the settings icon.
3. Enter your base Gmail address, for example:

```text
johndoe@gmail.com
```

4. Choose an alias format preset or enter a custom pattern.
5. Visit a signup/register page.
6. AliasShield can automatically fill a detected signup email field, or show a small floating widget with copy/regenerate controls.

When you click `Copy` in the popup, the alias is copied and saved into the recent aliases list.

## Alias Patterns

Default pattern:

```text
{base}+{domain}+{timestamp}@{host}
```

Common presets:

```text
{base}+{domain}+{YYYYMMDD}@{host}
{base}+{domain}+{YYMMDD}@{host}
{base}+{domain}@{host}
{base}+{domain}+{timestamp}@{host}
```

Supported tokens:

- `{base}`: Gmail username without dots or existing plus tags
- `{domain}`: cleaned website domain
- `{host}`: `gmail.com` or `googlemail.com`
- `{timestamp}`: short timestamp like `260512153045`
- `{YYYYMMDD}`: date like `20260512`
- `{YYMMDD}`: short date like `260512`
- `{YYYYMM}`: year and month like `202605`
- `{YYYY}`, `{YY}`, `{MM}`, `{DD}`, `{HH}`, `{mm}`: individual date/time parts

Example:

```text
{base}+{domain}+{YYYYMMDD}@{host}
```

Output:

```text
johndoe+exampledomain+20260512@gmail.com
```

## Popup Controls

- `Copy`: copies the current alias and saves it to history
- Refresh icon: regenerates the alias when the pattern supports regeneration
- `Disable on this site`: adds the current site to the blacklist
- `Enable on this site`: removes the current site from the blacklist
- Search: filters recent aliases
- Trash icon on an alias: deletes one alias
- Clear icon: clears all aliases after confirmation
- `Export TXT`: exports selected aliases as plain text
- `Export CSV`: exports selected aliases with metadata
- `Copy Gmail Query`: copies a Gmail-ready query for selected aliases

Example Gmail query:

```text
to:(alias1@gmail.com OR alias2@gmail.com OR alias3@gmail.com)
```

## Settings

The settings page includes:

- Base Gmail address
- Autofill toggle
- Floating widget toggle
- Quick copy shortcut toggle
- Alias format presets
- Custom alias pattern
- Live alias preview
- Pattern token reference
- Blacklisted domains
- Alias retention cleanup
- JSON backup export/import
- Theme toggle
- Saved/unsaved indicator

## Keyboard Shortcuts

Default Chrome commands:

- `Alt+Shift+A`: open AliasShield
- `Alt+Shift+C`: copy the current alias on supported pages

Chrome may reserve or override shortcuts. You can change them at:

```text
chrome://extensions/shortcuts
```

## Permissions

AliasShield requests only:

- `storage`: save settings and alias history locally
- `activeTab`: read the current active tab when the popup is opened
- `scripting`: inject content scripts into already-open pages when needed

Content scripts run on web pages so AliasShield can detect signup forms and show the floating widget.

## Privacy

AliasShield is local-only.

- No external servers
- No analytics
- No tracking
- No account system
- No remote database

Settings and aliases are stored in `chrome.storage.local`.

## Development

This extension uses:

- Manifest V3
- Vanilla JavaScript
- HTML/CSS
- Chrome extension APIs
- No frameworks
- No build step

Useful checks:

```bash
node --check popup/popup.js
node --check settings/settings.js
node --check content/main.js
node --check background/service-worker.js
```

After making changes, reload the extension from `chrome://extensions` and refresh any already-open test pages.

## Notes

Gmail plus addressing delivers mail to the base inbox as long as the alias is in this form:

```text
yourname+anything@gmail.com
```

Some websites block plus-addressing. In those cases, AliasShield cannot force the site to accept the alias.

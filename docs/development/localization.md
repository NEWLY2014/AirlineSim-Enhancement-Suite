# AES interface languages

AES supports English, German, Spanish, French, Hungarian, Dutch, Polish,
Traditional Chinese (Taiwan), and Japanese. By default it follows the game's
`frontendSettings.languageSettings.currentLanguageTag`, with the document's
language as a fallback. AES Settings offers a separate language override.
Changes take effect on the next page load, preserving any current form drafts.
The standalone backup page uses the override or the last detected game language.
Language preferences are included in settings backups.

Local catalogs live in `extension/locales/`. No translation service is called.
`AESI18n.t(source, values)` translates UI text with named or numbered placeholders;
missing entries fall back to the English source. Whitespace and interpolated
values are preserved. Render returned text through `textContent` / jQuery `.text()`.
Never use it to translate identifiers, selectors, user input, airline names,
airport codes, or stored data.

`AESI18n.html()` is only for complete AES-authored markup. It translates text
nodes and accessible labels, preserving original option values. Do not pass
fetched game markup, incomplete HTML fragments, or unescaped user data to it.
When the UI uses translated options or filter operators, save their explicit
values rather than the displayed labels. Use `AESI18n.whenReady()` before
rendering; `AES.runContentScript()` already does this.

Historical release-note content, technical diagnostics, and game-provided data
retain their original language. This layer translates AES UI; it does not
rewrite the game's content or change game-data parsing rules.

Run `npm test` for catalog key/placeholder parity, locale resolution, settings
persistence, data preservation, and translated filtering. `npm run test:browser`
loads the packaged extension and checks all nine settings locales, manual
override, draft preservation, UTF-8 text, and the backup page.

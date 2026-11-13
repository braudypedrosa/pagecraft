# Code native checklist

Status: **unverified**. Planning only. This checklist is derived from the Code DEF in `app/src/core/index.ts` and the existing inventory. It does not claim that any native Code setting has passed.

The finite direct controls are: **Code**, **Language**, **File name**, **Number the lines**, **Wrap long lines**, **Copy button**, **Background**, **Text colour**, **Text size**, **Padding**, **Radius**, and conditional token colours **Comments**, **Strings**, **Keywords**, **Numbers**, and **Names**. The DEF language choices are **Plain text**, **HTML**, **CSS**, **JavaScript**, **TypeScript**, **JSON**, **Shell**, and **Python**.

Use one fresh Code module on a disposable QA page. For every case, save, reload the editor, open Preview, and inspect actual DOM/text/computed styles at settled Desktop, Tablet, and Mobile widths. Keep all cases unverified until evidence is saved.

## C01 — baseline code and escaping

1. Set **Code** to multiline content containing `<tag attr="x"> &`, apostrophes, backticks, `//`, `/* block */`, blank lines, and a final newline. Set **Language** to **Plain text** and **File name** to `example.txt`.
2. Assert the published output uses the Code wrapper/pre/code structure, displays literal escaped characters, preserves line boundaries, and does not execute or create markup from the input.
3. Assert **File name** is rendered only where the module’s current output contract exposes it; preserve the exact displayed value after reload.

## C02 — finite language/highlighting matrix

1. Repeat a short syntax sample through all eight finite **Language** choices: Plain text, HTML, CSS, JavaScript, TypeScript, JSON, Shell, and Python.
2. Assert the language-specific class/token spans match the selected language and that unknown/plain text remains escaped. Include comments, strings, keywords, names, numbers, and calls where the language supports them.
3. For **HTML**, include quoted attributes and closing tags. For JSON, include quoted keys, strings, booleans, `null`, and numbers. For Shell/Python, include `#` comments. For JavaScript/TypeScript/CSS, include line/block comments and quoted strings.

## C03 — line controls and copy capability

1. Toggle **Number the lines** on and off. Assert line-number markup/count matches the number of non-empty rendered lines and does not alter code text.
2. Toggle **Wrap long lines** on with a line longer than the mobile viewport, then off. Assert the pre/code layout and overflow/wrapping behavior at D/T/M.
3. Exercise **Copy button** when the browser capability is available. Assert the button appears only when supported, copies the unmodified code text, and reports its success/fallback state without mutating the source. Record the unsupported-browser state separately if the control is hidden.

## C04 — direct Code style values

1. Set **Background** `#17202a`, **Text colour** `#f4f1ea`, **Text size** `16px`, **Padding** `18px 20px`, and **Radius** `12px`.
2. Save/reload and assert computed wrapper/pre/code styles, exact colours, size, padding, radius, and no accidental overflow. Confirm the selected language’s token colours remain scoped to the code module.
3. Keep colour values representative; do not infer palette completeness from one custom value.

## C05 — conditional token colour controls

1. With **Language** set to JavaScript, set **Comments**, **Strings**, **Keywords**, **Numbers**, and **Names** to distinct safe colours. Assert the matching token spans use those colours after reload.
2. Switch **Language** to Plain text. Assert those five conditional controls disappear from the inspector and no stale syntax-colour declarations are incorrectly applied to literal plain text.
3. Switch between HTML, CSS, JSON, TypeScript, Shell, and Python and record which token classes are actually emitted. Do not require a token category that the language definition does not generate.

## C06 — responsive values and reset

1. Set distinct Desktop/Tablet/Mobile **Text size**, **Padding**, **Background**, and **Text colour** values, for example `16px/14px/13px`, `18px 20px/12px 14px/10px 12px`, and three distinct safe colours.
2. Save/reload and assert each computed value at 1280/834/414px, including long-line behavior and no unintended horizontal overflow under both **Wrap long lines** states.
3. Reset Tablet and Mobile, save/reload, and assert they inherit the Desktop values rather than retaining stale declarations.

## C07 — Advanced, visibility, and conditional output

1. Set Advanced **HTML id**, **CSS classes**, **Custom CSS**, representative position/overflow/max width, and save/reload. Assert the Code wrapper receives the authored identity and scoped rule.
2. Toggle **Hide on Desktop**, **Hide on Tablet**, and **Hide on Mobile** one at a time. Assert the selected breakpoint is hidden and the other two remain visible, recording whether the renderer retains the DOM.
3. In Visibility **Show only if**, select a bindable field/property, operator **equals**, and value `show-code`. Assert matching output includes the complete Code wrapper/content and non-matching output omits the complete branch without an orphan file label or copy button.

## Reporting fields

For each case record: exact inspector label and selected value; pre-save/post-reload value; language; breakpoint; Preview DOM selectors and text; token classes/colours; computed styles; copy-button capability/state; overflow; condition match/non-match; evidence JSON/image path. Keep the entire checklist **unverified** until rendered proof exists. Candidate82 condition-control accessible labels remain a separate pending native check.

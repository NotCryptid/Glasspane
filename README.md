# glasspane

Build native desktop apps in JavaScript. You describe the UI with a SwiftUI-style API, and Glasspane renders it with WinUI 3 on Windows and SwiftUI on macOS. Your code runs on Node.js, so `fs`, `fetch`, databases and npm packages all work in event handlers.

```js
const { App, state, VStack, HStack, Text, Button, TextField } = require('@cryptidbleh/glasspane');

const count = state(0);
const name = state('');

App('Counter', () =>
  VStack(
    Text(`Count: ${count.value}`).font('largeTitle'),
    HStack(
      Button('-', () => count.value--),
      Button('+', () => count.value++).style('accent'),
    ),
    TextField('Your name', name),
    Text(`Hello, ${name.value || 'stranger'}`).foreground('secondary'),
  ).spacing(12).padding(32)
);
```

```
npx @cryptidbleh/glasspane app.js
```

On Windows the window uses the Mica backdrop, your system accent color, light and dark themes, and the standard Fluent controls. On macOS it is a SwiftUI window with system controls, colors and vibrancy. The same script runs on both.

## Windows

You need Windows 11 24H2 (build 26100) or newer (x64 or ARM64), [Node.js](https://nodejs.org) 20 or newer, and the [.NET SDK](https://dotnet.microsoft.com/download) 10 or newer. The first time you run an app, the SDK builds the host executable. After that you can run apps without .NET, because the host bundles its own runtime.

```
npm install @cryptidbleh/glasspane
npx @cryptidbleh/glasspane app.js
```

`node app.js` works too. It hands the script to `Glasspane.exe` and exits, so the app runs on its own like any other GUI program. Output from `console.log` still reaches the terminal, and the prompt returns right away.

Glasspane uses whichever Node.js you have installed, so it is not pinned to one version. Set `GLASSPANE_NODE` to a specific `node.exe` to choose one. `pack` uses that same variable when it bundles a runtime.

## macOS

You need macOS 27 or newer, [Node.js](https://nodejs.org) 20 or newer, and Xcode or the Command Line Tools (`xcode-select --install`, Swift 5.9 or newer). The first time you run an app, Swift builds the host.

```
npm install @cryptidbleh/glasspane
npx @cryptidbleh/glasspane app.js
npx glasspane pack app.js -n MyApp      # writes dist/MyApp.app
```

`pack` writes a `.app` bundle with the SwiftUI host, a copy of `node` and your project. The bundle is signed ad hoc, which is enough to run on the Mac that built it. Before you give it to other people, sign it with a Developer ID and notarize it. Glasspane does neither. Bundle the `node` from nodejs.org (set `GLASSPANE_NODE`), because a Homebrew `node` links libraries that other Macs lack. Icons are `.icns` files, or a `.png` that `pack` converts with `sips`. `--id com.you.app` sets the bundle identifier.

Differences from Windows:

- `Native(...)` names a WinUI control, so it renders nothing on macOS, though its children still show. Use the regular views if the app has to run on both.
- `backdrop` maps to a vibrancy material. `'mica'`, `'micaAlt'` and `'acrylic'` each get a different one, and `'none'` is the plain window color.
- `flex(n)` takes a share of the leftover space, but it ignores the weight `n`. Competing flex views split the space equally.
- `'mono'` uses the system monospaced font. Other Windows font names, such as `'Segoe UI'`, fall back to the system font. A button's `icon` takes a Windows symbol name (`'Add'`, `'Delete'`, `'Save'`) or any SF Symbol name.
- A Mac window has no icon of its own, so `window.icon` sets the Dock icon.
- `system.launch()` opens URLs in the default app. Windows protocols such as `ms-settings:` do nothing.

## Packaging on Windows

```
npx glasspane pack app.js -n MyApp
```

This writes `dist/MyApp/`, which holds `MyApp.exe`, the WinUI host, a copy of `node.exe`, and an `app/` copy of your project including `node_modules`. Zip the folder and ship it. Users need neither Node nor .NET, and `MyApp.exe` runs on a double-click.

Options: `-o <dir>` sets the output folder, `-n <name>` sets the exe name (default: `productName` or `name` from package.json), and `-i <file.ico>` sets the icon.

The result is a folder because WinUI and the Node runtime have to sit next to the exe. The bundled `node.exe` is about 90 MB, which is most of the folder. Run `npm install --omit=dev` in your project first so dev dependencies stay out of the package.

### Icons

Icons are `.ico` files. Include 16, 32, 48 and 256 px sizes. Set one when packaging:

```
npx glasspane pack app.js -n MyApp -i icon.ico
```

or set it once in `package.json`, which `pack` reads: `"glasspane": { "icon": "icon.ico" }`. To change the icon of an exe you already packaged:

```
npx glasspane icon dist/MyApp/MyApp.exe new.ico
```

That changes the file icon shown in Explorer, pinned taskbar entries and shortcuts. To set the title bar and taskbar icon while developing with `glasspane app.js`, or to change it at runtime, use the window option: `App({ title: 'Notes', icon: 'icon.ico' }, body)` or `system.window.icon = 'other.ico'`. Relative paths resolve from your script's folder.

Editing exe icons uses `rcedit`, which only works on Windows.

## How it works

On Windows, `Glasspane.exe` is a WinUI 3 program. On macOS it is a SwiftUI app that speaks the same protocol. Either one starts a stock Node.js as a child process, and the two
talk over stdin and stdout using newline-delimited JSON. Nothing is embedded, so any current Node.js
release works.

```
Glasspane.exe            your app runs in a child process
├── UI thread            WinUI 3 controls
└── node.exe             your script, npm packages, fs, fetch
        ⇅ newline-delimited JSON over stdin/stdout
```

Every message carries a window id, so the host routes it to the right native window. Since stdout is
the protocol channel, `console.log` and everything else the app prints goes to stderr, which the host
forwards to the terminal. Writing to stdout directly is ignored with a warning.

Your `body` function returns a description of the UI. It runs again whenever a `state` changes or an
event handler finishes, but only for the windows that read that state. The host compares the new
description with the controls it already has and updates only what differs, so focus, caret position
and scroll position survive a re-render.

`pack` bundles Node.js with your app, so a finished app needs nothing installed.

## State and bindings

```js
const text = state('');
text.value = 'hi';              // re-renders
text.update(s => s + '!');      // updater function; you can also mutate an object and return nothing
```

Pass a `state` to an input and the two stay in sync, like SwiftUI's `$binding`:

```js
TextField('Search', query)
Toggle('Dark mode', dark)
Slider(volume, { min: 0, max: 100 })
Picker('Sort by', sort, ['Name', 'Date', { label: 'Size', value: 'bytes' }])
```

For a one-way value, pass a plain value and add `.onChange(fn)`. `Binding(get, set)` binds to anything else.

## Views

| Group | Views |
|---|---|
| Layout | `VStack` `HStack` `ZStack` `ScrollView` `Card` `List` `Spacer` `Divider` |
| Content | `Text` `Image` `ProgressView` `Spinner` |
| Input | `Button` `TextField` `SecureField` `TextEditor` `Toggle` `Checkbox` `Slider` `Stepper` `Picker` |
| Helpers | `ForEach(items, render)` for keyed lists, `Native(type, props, ...children)` |

Stacks accept a props object first, as in `VStack({ spacing: 12, alignment: 'leading' }, ...)`. The same options exist as modifiers. `Spacer()` and `.flex()` split whatever space is left in a stack.

## Modifiers

Modifiers chain and each returns a new view.

| Kind | Modifiers |
|---|---|
| Layout | `padding` `margin` `frame` `width` `height` `fill` `flex` `hAlign` `vAlign` |
| Text | `font` `bold` `italic` `textAlign` `lineLimit` `selectable` |
| Appearance | `foreground` `background` `border` `cornerRadius` `opacity` `disabled` `hidden` `tooltip` |
| Behavior | `onTap` `onChange` `onSubmit` `on(event, fn)` `id(key)` |

`font` takes a preset (`'largeTitle'`, `'title'`, `'title2'`, `'title3'`, `'headline'`, `'body'`, `'caption'`, `'mono'`), a size, or `{ size, weight, italic, family }`.

Colors can be `'#RRGGBB'`, a name such as `'red'`, or a theme keyword like `'accent'`, `'primary'`, `'secondary'`, `'card'` or `'danger'`. Theme keywords follow light and dark mode.

`foreground`, `font` and `disabled` set on a container apply to its children unless they set their own. `padding` sits inside the background and `margin` outside it.

## System features

```js
const { system } = require('@cryptidbleh/glasspane');

await system.alert('Saved', { title: 'Done' });
if (await system.confirm('Delete everything?')) { /* ... */ }
const file = await system.openFile({ extensions: ['.png', '.jpg'] });
const out  = await system.saveFile({ name: 'notes.txt', extensions: ['.txt'] });
await system.clipboard.write('copied');
await system.launch('https://example.com');
system.window.title = 'Untitled (saved)';
system.quit();
```

These work on both platforms.

Window options go in the first argument to `App`:

```js
App({ title: 'Notes', width: 900, height: 640, backdrop: 'mica', theme: 'system' }, body)
```

`backdrop` is `'mica'`, `'micaAlt'`, `'acrylic'` or `'none'`, and `theme` is `'system'`, `'light'` or `'dark'`, and you can change it at runtime through `system.window.theme`.

## Any WinUI control

On Windows, you can create a control Glasspane has no wrapper for by its type name. Properties are converted from JSON (enum names, colors, thickness, numbers), and events send back the control's current value.

```js
Native('Expander', { Header: 'Advanced', IsExpanded: false }, Text('Hidden until opened'))
Native('CalendarDatePicker', { PlaceholderText: 'Pick a date' }).on('DateChanged', v => console.log(v))
Native('RatingControl', { Value: 3 }).on('ValueChanged', v => save(v))
```

## Platform differences in your code

`system.platform` is `'windows'` or `'macos'`. For small differences, branch on it. For bigger ones, keep one file per platform and require the right one:

```js
const mod = system.platform === 'macos' ? '\u2318' : 'Ctrl';
const shell = require(`./platform/shell.${system.platform}`);
Button(shell.revealLabel, () => shell.reveal(file));
```

`pack` copies the whole project, so every platform's file is included.

## Examples

```
glasspane examples/counter.js   # state, buttons, text field, toggle, slider
glasspane examples/todo.js      # keyed lists, Enter to submit, dialogs, save picker
glasspane examples/gallery.js   # every control, Native views, ZStack
glasspane examples/windows.js   # several windows, shared state, per-window dialogs
glasspane examples/platform.js  # system.platform and one file per OS
```

## Several windows

Call `App()` more than once to open more windows. Each one keeps its own UI tree, state and window
settings, and the process stays alive until the last one closes.

```js
const main = App('Notes', () => Text('Main window'));

const win = App({ title: 'Settings', width: 480, height: 360 }, () =>
  VStack(Text('Preferences'), Button('Close', () => win.close())).spacing(12).padding(24)
);

// Dialogs and window settings are per-window, so call them on the handle:
await win.confirm('Save changes?');
win.window.title = 'Settings (unsaved)';

// `system` without a window applies to whichever one is focused.
system.window.title = 'Notes';
```

`App()` returns that window's handle. Use `win.window` for its settings, `win.alert(...)` and the
rest of the dialog API bound to it, and `win.close()` to close it. `system.windowOf(win)` gives you
the same scoped API if you prefer to pass it around.

Closing the main window leaves the others running. `system.quit()` closes every window.

## Limits

- Node.js runs as a child process rather than inside the host, so Task Manager (Activity Monitor on macOS)
  shows two entries while an app runs. In return, you are not pinned to one Node version.
- stdout belongs to the protocol, so `console.log` is routed to stderr. A library that writes to
  `process.stdout` directly is ignored with a warning, so it cannot corrupt the message stream.

TypeScript definitions ship in `index.d.ts`.

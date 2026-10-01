# glasspane

Build native Windows apps in JavaScript. You describe the UI with a SwiftUI-style API, and Glasspane renders it with WinUI 3. Your code runs on Node.js inside the same process as the window, so `fs`, `fetch`, databases and npm packages work directly in event handlers.

```js
const { App, state, VStack, HStack, Text, Button, TextField } = require('@cryptidbleh/glasspane');

const count = state(0);
const name = state('');

App('Counter', () =>
  VStack(
    Text(`Count: ${count.value}`).font('largeTitle'),
    HStack(
      Button('−', () => count.value--),
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

The window uses the Mica backdrop, your system accent color, light and dark themes, and the standard Fluent controls, so it looks like any other Windows 11 app.

## Install and run

You need Windows 10 1809 or newer (x64 or ARM64) and the [.NET SDK](https://dotnet.microsoft.com/download) 10 or newer. The SDK is only used once, to build the host executable the first time you run an app. After that, no .NET install is needed to run apps, because the host bundles its own runtime.

```
npm install @cryptidbleh/glasspane
npx @cryptidbleh/glasspane app.js
```

`node app.js` works too. Node starts `Glasspane.exe`, passes it the script and exits, so Task Manager shows one process (Glasspane) with Node running inside it. Output from `console.log` still goes to the terminal, but the prompt returns right away because the app runs on its own, like any other GUI program.

## Packaging as an exe

```
npx glasspane pack app.js -n MyApp
```

This writes `dist/MyApp/` containing `MyApp.exe`, the host runtime (WinUI, Node) and an `app/` copy of your project, including `node_modules`. Zip the folder and ship it. Users need neither Node nor .NET. Double-click `MyApp.exe` to run it. Options: `-o <dir>` for the output folder and `-n <name>` for the exe name (default: `productName` or `name` from package.json).

It is a folder, not a single file. WinUI and `libnode.dll` have to sit next to the exe. Run `npm install --omit=dev` in your project first so dev dependencies are not shipped. The packaged exe has the default icon.

## How it works

The host, `Glasspane.exe`, is a WinUI 3 program that embeds Node.js 20 as a library (`libnode.dll`) on a background thread. The window and your JavaScript share one process and pass messages as in-memory strings.

```
Glasspane.exe
├── UI thread    WinUI 3 controls
└── Node thread  your script and npm packages
```

Your `body` function returns a description of the UI. It runs again whenever a `state` changes or an event handler finishes. The host compares the new description with the controls it already has and updates only what differs, so focus, caret position and scroll position survive a re-render.

Node comes from the host, so users do not need it installed to run a finished app. Native `.node` addons have not been tested in the embedded runtime.

## State and bindings

```js
const text = state('');
text.value = 'hi';              // re-renders
text.update(s => s + '!');      // updater function; mutating an object and returning nothing also works
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

Stacks accept a props object first, as in `VStack({ spacing: 12, alignment: 'leading' }, ...)`. The same options exist as modifiers. `Spacer()` and `.flex()` split the space left over in a stack.

## Modifiers

Modifiers chain and each returns a new view.

| Kind | Modifiers |
|---|---|
| Layout | `padding` `margin` `frame` `width` `height` `fill` `flex` `hAlign` `vAlign` |
| Text | `font` `bold` `italic` `textAlign` `lineLimit` `selectable` |
| Appearance | `foreground` `background` `border` `cornerRadius` `opacity` `disabled` `hidden` `tooltip` |
| Behavior | `onTap` `onChange` `onSubmit` `on(event, fn)` `id(key)` |

`font` takes a preset (`'largeTitle'`, `'title'`, `'title2'`, `'title3'`, `'headline'`, `'body'`, `'caption'`, `'mono'`), a size, or `{ size, weight, italic, family }`.

Colors can be `'#RRGGBB'`, a name such as `'red'`, or a theme keyword (`'accent'`, `'primary'`, `'secondary'`, `'card'`, `'danger'`, and a few more) that follows light and dark mode.

`foreground`, `font` and `disabled` set on a container apply to its children unless they set their own. `padding` sits inside the background and `margin` outside it.

## Windows features

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

Window options go in the first argument to `App`:

```js
App({ title: 'Notes', width: 900, height: 640, backdrop: 'mica', theme: 'system' }, body)
```

`backdrop` is `'mica'`, `'micaAlt'`, `'acrylic'` or `'none'`. `theme` is `'system'`, `'light'` or `'dark'`, and you can change it at runtime through `system.window.theme`.

## Any WinUI control

A control Glasspane has no wrapper for can be created by type name. Properties are converted from JSON (enum names, colors, thickness, numbers), and events send back the control's current value.

```js
Native('Expander', { Header: 'Advanced', IsExpanded: false }, Text('Hidden until opened'))
Native('CalendarDatePicker', { PlaceholderText: 'Pick a date' }).on('DateChanged', v => console.log(v))
Native('RatingControl', { Value: 3 }).on('ValueChanged', v => save(v))
```

## Examples

```
glasspane examples/counter.js   # state, buttons, text field, toggle, slider
glasspane examples/todo.js      # keyed lists, Enter to submit, dialogs, save picker
glasspane examples/gallery.js   # every control, Native views, ZStack
```

## Limits

- One window per process.
- A render error shows its stack trace in the window instead of leaving it blank.
- The embedded runtime is Node 20.18, the newest `libnode` build Microsoft publishes.
- `'accent'` used as a text color is resolved when the app starts and does not follow later theme changes.
- TypeScript definitions ship in `index.d.ts`.

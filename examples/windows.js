'use strict';

// Several windows in one process. Each `App()` call opens its own window with its own UI,
// state and settings. The process stays alive until the last window closes.

const { App, state, system } = require('../lib/index.js');
const { VStack, HStack, Text, Button, Spacer, Divider } = require('../lib/view.js');

const count = state(0);
const log = state([]);

const note = (line) => log.update((lines) => [line, ...lines].slice(0, 6));

// ---- main window -----------------------------------------------------------

App({ title: 'Windows', width: 560, height: 460 }, () =>
  VStack(
    Text('Main window').font('title2'),
    Text(`Count is ${count.value}`).font('title3').foreground('accent'),

    HStack(
      Button('-1', () => count.update((n) => n - 1)),
      Button('+1', () => count.update((n) => n + 1)).style('accent'),
      Spacer(),
      Button('Open a window', () => openInspector()).style('accent'),
    ).spacing(8),

    Divider(),

    Text('Recent activity').font('headline'),
    ...(log.value.length
      ? log.value.map((line) => Text(line).font('caption').foreground('secondary'))
      : [Text('Nothing yet').font('caption').foreground('disabled')]),

    Spacer(),
    HStack(Button('Quit everything', () => system.quit())).hAlign('end'),
  ).spacing(14).padding(24)
);

// ---- a second, independent window ------------------------------------------

function openInspector() {
  const draft = state('');

  const win = App({ title: 'Inspector', width: 420, height: 320, backdrop: 'acrylic' }, () =>
    VStack(
      Text('Inspector').font('title3'),
      Text('This window has its own state and settings.').font('caption').foreground('secondary'),
      // Bound to `count`, so pressing this changes the main window too.
      Button(`Set main count to ${count.value + 1}`, () => {
        count.value = count.value + 1;
        note(`main count -> ${count.value}`);
      }),
      Text(`Draft: ${draft.value || '(empty)'}`).foreground('secondary'),
      Spacer(),
      HStack(
        // Dialogs on the handle belong to this window, so Windows parents them to it.
        Button('Alert here', async () => {
          await win.alert('This alert is parented to the inspector window.');
          note('inspector alert dismissed');
        }),
        Spacer(),
        // Closing one window leaves the others running.
        Button('Close', () => {
          note('inspector closed');
          win.close();
        }),
      ).spacing(8),
    ).spacing(12).padding(20)
  );

  win.window.title = `Inspector #${count.value + 1}`;
  note('inspector opened');
  return win;
}

note('app started');
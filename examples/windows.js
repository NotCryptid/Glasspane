'use strict';

// Several windows in one process. Each `App()` call opens its own window with its own UI,
// state and settings. The process stays alive until the last window closes.

const { App, state, system } = require('../lib/index.js');
const { VStack, HStack, Text, Icon, Button, Card, Spacer, Divider } = require('../lib/view.js');

const R = system.cornerRadiusMultiplier;
const count = state(0);
const log = state([]);

const note = (line) => log.update((lines) => [line, ...lines].slice(0, 6));

// ---- main window -----------------------------------------------------------

App({ title: 'Windows', width: 560, height: 460 }, () =>
  VStack(
    HStack(
      Icon('newWindow').font(18).foreground('accent'),
      Text('Main window').font('title2'),
    ).alignment('center').spacing(8),
    Text(`Count is ${count.value}`).font('title3').foreground('accent'),

    HStack(
      Button('-1', () => count.update((n) => n - 1)).icon('minus'),
      Button('+1', () => count.update((n) => n + 1)).icon('plus').style('accent'),
      Spacer(),
      Button('Open a window', () => openInspector()).icon('newWindow').style('accent'),
    ).spacing(8),

    Divider(),

    Card(
      Text('Recent activity').font('headline'),
      ...(log.value.length
        ? log.value.map((line) => Text(line).font('caption').foreground('secondary'))
        : [Text('Nothing yet').font('caption').foreground('disabled')]),
    ).cornerRadius(18 * R),

    Spacer(),
    HStack(Button('Quit everything', () => system.quit()).icon('close')).hAlign('end'),
  ).spacing(14).padding(24)
);

// ---- a second, independent window ------------------------------------------

function openInspector() {
  const draft = state('');

  const win = App({ title: 'Inspector', width: 420, height: 320, backdrop: 'acrylic' }, () =>
    VStack(
      HStack(
        Icon('info').font(16).foreground('accent'),
        Text('Inspector').font('title3'),
      ).alignment('center').spacing(8),
      Text('This window has its own state and settings.').font('caption').foreground('secondary'),
      // Bound to `count`, so pressing this changes the main window too.
      Button(`Set main count to ${count.value + 1}`, () => {
        count.value = count.value + 1;
        note(`main count -> ${count.value}`);
      }).icon('plus'),
      Text(`Draft: ${draft.value || '(empty)'}`).foreground('secondary'),
      Spacer(),
      HStack(
        // Dialogs on the handle belong to this window, so Windows parents them to it.
        Button('Alert here', async () => {
          await win.alert('This alert is parented to the inspector window.');
          note('inspector alert dismissed');
        }).icon('bell'),
        Spacer(),
        // Closing one window leaves the others running.
        Button('Close', () => {
          note('inspector closed');
          win.close();
        }).icon('close'),
      ).spacing(8),
    ).spacing(12).padding(20)
  );

  win.window.title = `Inspector #${count.value + 1}`;
  note('inspector opened');
  return win;
}

note('app started');
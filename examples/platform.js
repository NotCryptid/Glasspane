const { App, state, system, VStack, Text, Button, Card } = require('..');

// Each file in examples/platform/ holds one OS's version of the same small API.
const shell = system.load('./platform/shell');

const revealed = state(false);

App({ title: 'Platform', width: 460, height: 340 }, () =>
  VStack(
    Text(`Running on ${system.platform}`).font('title'),
    Card(
      Text(`Save with ${shell.shortcut}`),
      Text(`Loaded shell.${system.platform}.js`).font('caption').foreground('secondary'),
    ).width(300),
    Button(shell.revealLabel, () => { shell.reveal(__filename); revealed.value = true; }),
    Text(revealed.value ? 'Opened.' : '').foreground('secondary'),
    // pick() is for small differences that do not need their own file.
    Text(system.pick({ windows: 'Mica backdrop', macos: 'Vibrancy backdrop', default: 'Plain backdrop' }))
      .font('caption').foreground('secondary'),
  ).spacing(14).padding(32),
);

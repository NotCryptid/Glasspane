const { App, state, system, VStack, Text, Button, Card } = require('..');

// Each file in examples/platform/ holds one OS's version of the same small API.
const shell = require(`./platform/shell.${system.platform}`);

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
  ).spacing(14).padding(32),
);

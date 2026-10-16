const { App, state, system, VStack, HStack, Text, Icon, Button, Card } = require('..');

// Each file in examples/platform/ holds one OS's version of the same small API.
const shell = require(`./platform/shell.${system.platform}`);

const R = system.cornerRadiusMultiplier;
const revealed = state(false);

App({ title: 'Platform', width: 460, height: 340 }, () =>
  VStack(
    HStack(
      Icon('remote').font(22).foreground('accent'),
      Text(`Running on ${system.platform}`).font('title'),
    ).alignment('center').spacing(10),
    Card(
      Text(`Save with ${shell.shortcut}`),
      Text(`Loaded shell.${system.platform}.js`).font('caption').foreground('secondary'),
    ).width(300).cornerRadius(18 * R),
    Button(shell.revealLabel, () => { shell.reveal(__filename); revealed.value = true; }).icon('folder'),
    Text(revealed.value ? 'Opened.' : '').foreground('secondary'),
  ).spacing(14).padding(32),
);


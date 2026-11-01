const { App, state, system, VStack, HStack, Text, Icon, Button } = require('..');
const { chrome, top, panel } = require('./style');

// Each file in examples/platform/ holds one OS's version of the same small API.
const shell = require(`./platform/shell.${system.platform}`);

const revealed = state(false);

App({ title: 'Platform', width: 460, height: 340, ...chrome }, () =>
  VStack(
    HStack(
      Icon('remote').font(22).foreground('accent'),
      Text(`Running on ${system.platform}`).font('title'),
    ).alignment('center').spacing(8),
    panel(VStack(
      Text(`Save with ${shell.shortcut}`),
      Text(`Loaded shell.${system.platform}.js`).font('caption').foreground('secondary'),
    ).alignment('leading').spacing(4).fillWidth()).width(300),
    Button(shell.revealLabel, () => { shell.reveal(__filename); revealed.value = true; }).icon('folder'),
    Text(revealed.value ? 'Opened.' : '').foreground('secondary'),
  ).spacing(12).padding({ top: top + 24, horizontal: 32, bottom: 32 }),
);


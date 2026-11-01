const { App, state, VStack, HStack, Text, Icon, Button, TextField, Toggle, Slider, Spacer } = require('..');
const { chrome } = require('./style');

const count = state(0);
const name = state('');
const loud = state(false);
const volume = state(40);

// The window is the whole UI: no card inside it.
App({ title: 'Counter', width: 480, height: 560, ...chrome }, () =>
  VStack(
    Spacer(),
    Text(`Count: ${count.value}`).font('largeTitle'),
    HStack(
      Button('', () => count.value--).icon('minus').tooltip('Decrement'),
      Button('Reset', () => { count.value = 0; }).icon('refresh'),
      Button('', () => count.value++).icon('plus').tooltip('Increment').style('accent'),
    ),
    TextField('Your name', name).width(260),
    Text(name.value ? `Hello, ${loud.value ? name.value.toUpperCase() : name.value}!` : 'Type your name above')
      .foreground('secondary'),
    Toggle('Shout', loud),
    HStack(
      Icon(volume.value === 0 ? 'mute' : 'volume').foreground('secondary'),
      Slider(volume, { min: 0, max: 100 }).width(232),
    ).spacing(8),
    Text(`Volume ${Math.round(volume.value)}`).font('caption').foreground('secondary'),
    Spacer(),
  ).spacing(12).padding(32),
);

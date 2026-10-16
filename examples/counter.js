const { App, state, system, VStack, HStack, Text, Icon, Button, TextField, Toggle, Slider, Spacer } = require('..');

const R = system.cornerRadiusMultiplier;
const count = state(0);
const name = state('');
const loud = state(false);
const volume = state(40);

App({ title: 'Counter', width: 480, height: 560 }, () =>
  VStack(
    Text(`Count: ${count.value}`).font('largeTitle'),
    HStack(
      Button('', () => count.value--).icon('minus').tooltip('Decrement').width(48),
      Button('Reset', () => { count.value = 0; }).icon('refresh'),
      Button('', () => count.value++).icon('plus').tooltip('Increment').style('accent').width(48),
    ),
    TextField('Your name', name).width(260),
    Text(name.value ? `Hello, ${loud.value ? name.value.toUpperCase() : name.value}!` : 'Type your name above')
      .foreground('secondary'),
    Toggle('Shout', loud),
    HStack(
      Icon(volume.value === 0 ? 'mute' : 'volume').foreground('secondary'),
      Slider(volume, { min: 0, max: 100 }).width(230),
    ).spacing(10),
    Text(`Volume ${Math.round(volume.value)}`).font('caption').foreground('secondary'),
    Spacer(),
  ).spacing(14).padding(32).cornerRadius(18 * R),
);

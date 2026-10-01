const { App, state, VStack, HStack, Text, Button, TextField, Toggle, Slider, Spacer } = require('..');

const count = state(0);
const name = state('');
const loud = state(false);
const volume = state(40);

App({ title: 'Counter', width: 480, height: 560 }, () =>
  VStack(
    Text(`Count: ${count.value}`).font('largeTitle'),
    HStack(
      Button('-', () => count.value--).width(48),
      Button('Reset', () => { count.value = 0; }),
      Button('+', () => count.value++).style('accent').width(48),
    ),
    TextField('Your name', name).width(260),
    Text(name.value ? `Hello, ${loud.value ? name.value.toUpperCase() : name.value}!` : 'Type your name above')
      .foreground('secondary'),
    Toggle('Shout', loud),
    Slider(volume, { min: 0, max: 100 }).width(260),
    Text(`Volume ${Math.round(volume.value)}`).font('caption').foreground('secondary'),
    Spacer(),
  ).spacing(14).padding(32),
);

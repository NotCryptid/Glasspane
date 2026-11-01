const {
  App, state, system, VStack, HStack, ZStack, Text, Icon, Button, TextField, SecureField, TextEditor, Toggle,
  Slider, Stepper, Picker, ProgressView, Spinner, List, ScrollView, Native,
} = require('..');
const { R, chrome, top, panel } = require('./style');
const fruit = state('Banana');
const qty = state(2);
const progress = state(35);
const notes = state('Multi-line\nnotes');
const pw = state('');
const selected = state(0);
const items = ['Inbox', 'Sent', 'Drafts', 'Archive'];

App({ title: 'Gallery', width: 760, height: 720, ...chrome }, () =>
  ScrollView(
    VStack(
      Text('Glasspane gallery').font('largeTitle'),
      Text('Every control below is a real native control.').foreground('secondary'),

      panel(VStack(
        HStack(Icon('edit').foreground('accent'), Text('Inputs').font('title3')).spacing(8),
        Picker('Fruit', fruit, ['Apple', 'Banana', 'Cherry']).width(240),
        Stepper('Quantity', qty, { min: 0, max: 10 }),
        SecureField('Password', pw).width(240),
        TextEditor(notes).height(90).width(320),
        Text(`${qty.value} × ${fruit.value}`).foreground('accent'),
      ).alignment('leading').spacing(8).fillWidth()),

      panel(VStack(
        HStack(Icon('refresh').foreground('accent'), Text('Progress').font('title3')).spacing(8),
        ProgressView(progress.value / 100).width(320),
        Slider(progress, { min: 0, max: 100 }).width(320),
        HStack(Spinner().width(24).height(24), Text('Working…').foreground('secondary')),
      ).alignment('leading').spacing(8).fillWidth()),

      panel(VStack(
        HStack(Icon('list').foreground('accent'), Text('List with selection').font('title3')).spacing(8),
        List(items, (name) => Text(name)).selection(selected).height(130),
        Text(`Selected: ${items[selected.value]}`).foreground('secondary'),
      ).alignment('leading').spacing(8).fillWidth()),

      panel(VStack(
        HStack(Icon('settings').foreground('accent'), Text('Native escape hatch').font('title3')).spacing(8),
        Native('Expander', { Header: 'Any WinUI control works', IsExpanded: true },
          Text('This is a Microsoft.UI.Xaml.Controls.Expander created by name.').padding(8)),
        Native('RatingControl', { Value: 3 }).on('ValueChanged', (v) => console.log('rating', v)),
        Native('HyperlinkButton', { Content: 'glasspane on GitHub' }).on('Click', () => system.launch('https://github.com')),
      ).alignment('leading').spacing(8).fillWidth()),

      ZStack(
        Text('ZStack').font('headline').padding(24).background('accent').cornerRadius(12 * R).foreground('white'),
        Text('overlay').font('caption').foreground('white').hAlign('end').vAlign('start').margin(4),
      ),

      HStack(
        Button('Alert…', () => system.alert('Hello from Node', { title: 'glasspane' })).icon('bell'),
        Button('Copy', () => system.clipboard.write('copied from glasspane')).icon('copy'),
        Button('Open file…', async () => console.log(await system.openFile())).icon('folder'),
        Button('Quit', system.quit).icon('close').style('accent'),
      ),
    ).alignment('stretch').spacing(16).padding({ top: top + 16, horizontal: 28, bottom: 28 }),
  ));

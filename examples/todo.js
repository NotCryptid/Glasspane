const fs = require('node:fs');
const {
  App, state, system, VStack, HStack, Text, Button, TextField, Checkbox, ScrollView, ForEach, Divider, Spacer,
} = require('..');

let nextId = 3;
const todos = state([
  { id: 1, text: 'Read the glasspane README', done: true },
  { id: 2, text: 'Build something native', done: false },
]);
const draft = state('');

function add() {
  const text = draft.value.trim();
  if (!text) return;
  todos.update((list) => [...list, { id: nextId++, text, done: false }]);
  draft.value = '';
}

async function save() {
  const path = await system.saveFile({ name: 'todos.json', extensions: ['.json'] });
  if (path) fs.writeFileSync(path, JSON.stringify(todos.value, null, 2));
}

App({ title: 'Todos', width: 520, height: 600 }, () => {
  const remaining = todos.value.filter((t) => !t.done).length;
  return VStack(
    Text('Todos').font('largeTitle'),
    HStack(
      TextField('What needs doing?', draft).onSubmit(add).flex(),
      Button('Add', add).icon('Add').style('accent'),
    ).alignment('center'),
    ScrollView(
      VStack(
        ...ForEach(todos.value, (t) =>
          HStack(
            Checkbox(t.text, t.done).onChange((v) => { t.done = v; }).flex(),
            Button('', async () => {
              if (await system.confirm(`Delete "${t.text}"?`, { title: 'Delete todo', ok: 'Delete' })) {
                todos.value = todos.value.filter((x) => x.id !== t.id);
              }
            }).icon('Delete').tooltip('Delete'),
          )),
      ).alignment('stretch').spacing(4),
    ).flex(),
    Divider(),
    HStack(
      Text(`${remaining} left`).foreground('secondary'),
      Spacer(),
      Button('Save…', save),
    ),
  ).alignment('stretch').spacing(12).padding(24);
});

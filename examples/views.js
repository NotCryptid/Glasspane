// The views and modifiers that exist in both SwiftUI and WinUI: tabs, a split view, menus, a grid,
// date and color pickers, shapes, gradients, popovers, sheets and context menus.
const {
  App, state, system, VStack, HStack, ZStack, Text, Button, Label, Link, DatePicker, ColorPicker, SearchField,
  DisclosureGroup, TabView, Tab, SplitView, Menu, MenuItem, Divider, Grid, GridRow, Picker, ScrollView, List,
  Rectangle, RoundedRectangle, Circle, Capsule, LinearGradient, Toggle,
} = require('..');
const { R } = require('./style');

const tab = state(0);
const page = state(0);
const when = state(new Date());
const at = state(new Date());
const tint = state('#3478F6');
const query = state('');
const view = state('Day');
const showPopover = state(false);
const showSheet = state(false);
const hovered = state(false);
const log = state('Nothing yet');
const sections = ['Overview', 'Layout', 'Pickers'];

const overview = () =>
  VStack(
    Text('Shapes and gradients').font('title3'),
    HStack(
      RoundedRectangle(14).foreground(LinearGradient(['#ff5f6d', '#ffc371'], 'topLeading', 'bottomTrailing')).frame(90, 60),
      Circle().foreground(tint.value).stroke('primary', 2).frame(60, 60),
      Capsule().foreground('accent').frame(100, 36),
      Rectangle().foreground('green').frame(60, 60).rotation(20).opacity(0.8),
      Text('scaled').scale(1.4).offset(10, 0),
    ).spacing(24),
    Divider(),
    Text('Menus, popovers and sheets').font('title3'),
    HStack(
      Menu('Actions',
        MenuItem('New', () => { log.value = 'New'; }).icon('add').shortcut('CmdOrCtrl+N'),
        MenuItem('Autosave', () => { log.value = 'Autosave'; }).checked(true),
        Divider(),
        Menu('More', MenuItem('Export', () => { log.value = 'Export'; })),
      ),
      Button('Popover', () => { showPopover.value = true; })
        .popover(showPopover, { edge: 'bottom' }, VStack(Text('Hello from a popover'), Button('Close', () => { showPopover.value = false; })).spacing(8).padding(12)),
      Button('Sheet', () => { showSheet.value = true; }).style('accent')
        .sheet(showSheet, VStack(Text('A sheet').font('title3'), Text('It sits over the window.'), Button('Done', () => { showSheet.value = false; })).spacing(10).padding(24).minWidth(280)),
      Button('Delete', () => { log.value = 'Delete'; }).style('destructive'),
      Button('Plain', () => { log.value = 'Plain'; }).style('plain'),
    ).spacing(12),
    Text(`Last action: ${log.value}`).foreground('secondary'),
    Text(hovered.value ? 'Hovering. Right-click or double-click me.' : 'Hover, right-click or double-click me')
      .padding(12).background('card').cornerRadius(12 * R)
      .onHover((on) => { hovered.value = on; })
      .onDoubleTap(() => { log.value = 'Double tap'; })
      .contextMenu(MenuItem('Copy', () => { log.value = 'Copy'; }).icon('copy'), Divider(), MenuItem('Delete', () => { log.value = 'Context delete'; })),
    Label('A label with an icon', 'heart'),
    Link('Open the project page', 'https://github.com/NotCryptid/Glasspane'),
    Text('Underlined, struck and tracked').underline().tracking(2),
  ).spacing(12).alignment('leading').padding(20);

const layout = () =>
  VStack(
    Text('Grid').font('title3'),
    Grid({ hSpacing: 24 },
      GridRow(Text('Name').bold().hAlign('leading'), Text('Role').bold().hAlign('leading'), Text('Score').bold()),
      GridRow(Text('Ada').hAlign('leading'), Text('Engineer').hAlign('leading'), Text('98')),
      GridRow(Text('Grace').hAlign('leading'), Text('Admiral').hAlign('leading'), Text('100')),
    ),
    DisclosureGroup('Advanced', Text('Hidden until opened'), Toggle('Enabled', state(true))),
    Picker('View', view, ['Day', 'Week', 'Month']).style('segmented'),
    Picker('View', view, ['Day', 'Week', 'Month']).style('radio'),
  ).spacing(12).alignment('leading').padding(20);

const pickers = () =>
  VStack(
    DatePicker('Date', when),
    DatePicker('Time', at, { mode: 'time' }),
    Text(`${when.value.toDateString()} at ${at.value.toTimeString().slice(0, 5)}`).foreground('secondary'),
    ColorPicker('Tint', tint),
    Text(tint.value).foreground(tint.value),
    SearchField('Search the docs', query),
    Text(query.value ? `Searching for "${query.value}"` : 'Type to search').foreground('secondary'),
  ).spacing(12).alignment('leading').padding(20);

const pages = [overview, layout, pickers];

App({ title: 'Views', width: 860, height: 640 }, () =>
  TabView(tab,
    Tab('Tabs', ScrollView(overview())).icon('home'),
    Tab('Split view',
      SplitView(
        List(sections, (name) => Text(name)).selection(page),
        ScrollView(pages[page.value]()),
        { sidebarWidth: 200 },
      ),
    ).icon('list'),
  )
);

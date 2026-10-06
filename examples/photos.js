const path = require('node:path');
const { App, state, system, VStack, HStack, ZStack, Text, TextField, Icon, Image, ScrollView, Spacer } = require('..');

const art = (file) => path.join(__dirname, 'photos', file + '.png');
const MAC = system.platform === 'macos';

const PHOTOS = [
  { id: 'golden-hour', title: 'Golden Hour', tab: 'Landscapes' },
  { id: 'alpine-dawn', title: 'Alpine Dawn', tab: 'Landscapes' },
  { id: 'teal-dusk', title: 'Teal Dusk', tab: 'Landscapes' },
  { id: 'ember-flow', title: 'Ember Flow', tab: 'Abstract' },
  { id: 'ocean-glass', title: 'Ocean Glass', tab: 'Abstract' },
  { id: 'sorbet', title: 'Sorbet', tab: 'Abstract' },
  { id: 'nebula', title: 'Violet Nebula', tab: 'Cosmos' },
  { id: 'red-giant', title: 'Red Giant', tab: 'Cosmos' },
  { id: 'ice-world', title: 'Ice World', tab: 'Cosmos' },
];
// Sidebar tabs: [name, SF Symbol, Windows Symbol]
const TABS = [
  ['All Photos', 'photo.on.rectangle', 'Pictures'],
  ['Landscapes', 'mountain.2', 'Map'],
  ['Abstract', 'paintpalette', 'Edit'],
  ['Cosmos', 'moon.stars', 'Globe'],
  ['Favorites', 'heart', 'Favorite'],
];
const COLUMNS = 3;
const TILE = 200; // three rows end level with the bottom of the sidebar in the default 1040x720 window

const tab = state(0);
const query = state('');
const favs = state(['nebula', 'golden-hour']);

const toggleFav = (id) => {
  favs.value = favs.value.includes(id) ? favs.value.filter((f) => f !== id) : [...favs.value, id];
};

const visible = () => {
  const name = TABS[tab.value][0];
  const q = query.value.trim().toLowerCase();
  return PHOTOS.filter((p) =>
    (tab.value === 0 || (name === 'Favorites' ? favs.value.includes(p.id) : p.tab === name)) &&
    (!q || p.title.toLowerCase().includes(q)));
};

const sidebarRow = ([name, sf, win], i) => {
  const on = tab.value === i;
  return HStack(
    Icon(MAC ? sf : win).width(22).foreground(on ? 'accent' : 'secondary'),
    Text(name).fontWeight(on ? 'semibold' : 'regular'),
    Spacer(),
  ).spacing(8).padding({ vertical: 8, horizontal: 12 }).fillWidth().cornerRadius(12)
    .background(on ? '#26808080' : 'transparent').onTap(() => { tab.value = i; });
};

const tile = (p) => ZStack(
  Image(art(p.id)).fit('cover').height(TILE).fillWidth(),
  Image(art('scrim')).fit('fill').height(TILE).fillWidth(),
  Text(p.title).font('headline').foreground('white').hAlign('start').vAlign('end').padding(14),
  favs.value.includes(p.id) ? Text('♥').foreground('white').hAlign('end').vAlign('start').padding(12) : null,
).cornerRadius(18).flex(1).onTap(() => toggleFav(p.id));

const rows = (photos) => {
  const out = [];
  for (let i = 0; i < photos.length; i += COLUMNS) {
    const row = photos.slice(i, i + COLUMNS).map(tile);
    while (row.length < COLUMNS) row.push(Spacer().flex(1)); // keep the last row's tiles the same width
    out.push(HStack(...row).spacing(14));
  }
  return out;
};

App({
  title: 'Photos', width: 1040, height: 720, backdrop: 'micaAlt',
  icon: 'photos/icon.png',   // one PNG: becomes the .ico on Windows and the Dock icon on macOS
  titleBar: 'hidden',        // content runs under the title bar, so the traffic lights sit on the sidebar
  cornerRadius: 26,
  // The menu bar. It is a function so the View menu's checkmark follows the selected tab.
  menu: () => [
    { label: 'File', items: [
      { label: 'Clear Favorites', enabled: favs.value.length > 0, onClick: () => { favs.value = []; } },
      !MAC && '-',
      !MAC && { role: 'quit' },   // on a Mac, Quit lives in the app menu
    ] },
    'edit',
    { label: 'View', items: [
      ...TABS.map(([name], i) => ({ label: name, shortcut: `CmdOrCtrl+${i + 1}`, checked: tab.value === i, onClick: () => { tab.value = i; } })),
      '-',
      { role: 'fullscreen' },
    ] },
    'window',
    'help',
  ],
}, () => {
  const photos = visible();
  return ZStack(
    photos.length
      ? ScrollView(
        VStack(
          Text(TABS[tab.value][0]).font('largeTitle').hAlign('start').padding({ bottom: 4 }),
          ...rows(photos),
        ).alignment('stretch').spacing(14).padding({ top: 20, right: 12, bottom: 8, left: 16 }),
      ).padding({ left: 238 })
      : VStack(
        Spacer(),
        Text(query.value ? 'No photos match your search' : 'Click a photo to add it to Favorites').foreground('secondary'),
        Spacer(),
      ).padding({ left: 238 }),

    // The search field floats over the photos on its own glass pill.
    HStack(
      Spacer(),
      HStack(
        Icon(MAC ? 'magnifyingglass' : 'Find').foreground('secondary'),
        TextField('Search', query).style('plain').width(170),
      ).spacing(8).padding({ vertical: 9, horizontal: 14 }).glass(100),
    ).vAlign('start').padding({ top: 14, right: 20 + system.titleBarInsets.right }), // clear of the Windows caption buttons

    // The sidebar floats over the window on a glass surface; the traffic lights sit on it.
    VStack(
      ...TABS.map(sidebarRow),
      Spacer(),
    ).alignment('stretch').spacing(2).padding({ top: MAC ? 52 : 14, horizontal: 10, bottom: 10 })
      .width(226).fillHeight().glass(18).margin(8), // 18 = the window's 26 minus the 8 point inset
  ).alignment('topLeading');
});

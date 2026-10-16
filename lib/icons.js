'use strict';

/**
 * Universal icon table. Each universal name maps to a Windows `Symbol` enum name and a macOS
 * SF Symbol name. Every mapping also works bidirectionally when you pass a native Windows
 * `Symbol` or macOS SF Symbol name directly:
 *   - Icon('eye')      -> 'eye' on macOS, 'View' on Windows
 *   - Icon('View')     -> 'View' on Windows, 'eye' on macOS
 *   - Icon('photos')   -> 'Pictures' on Windows, 'photo.on.rectangle' on macOS
 *   - Icon({ windows: 'Pictures', macos: 'photo.on.rectangle' })
 *   - Icon('win:Pictures') / Icon('sf:photo.on.rectangle')
 */
const ICONS = {
  // Navigation & actions
  add:              { windows: 'Add',                    macos: 'plus' },
  plus:             { windows: 'Add',                    macos: 'plus' },
  remove:           { windows: 'Remove',                 macos: 'minus' },
  minus:            { windows: 'Remove',                 macos: 'minus' },
  delete:           { windows: 'Delete',                 macos: 'trash' },
  trash:            { windows: 'Delete',                 macos: 'trash' },
  edit:             { windows: 'Edit',                   macos: 'pencil' },
  rename:           { windows: 'Rename',                 macos: 'pencil.and.outline' },
  save:             { windows: 'Save',                   macos: 'square.and.arrow.down' },
  saveLocal:        { windows: 'SaveLocal',              macos: 'arrow.down.doc' },
  check:            { windows: 'Accept',                 macos: 'checkmark' },
  accept:           { windows: 'Accept',                 macos: 'checkmark' },
  close:            { windows: 'Cancel',                 macos: 'xmark' },
  cancel:           { windows: 'Cancel',                 macos: 'xmark' },
  clear:            { windows: 'Clear',                  macos: 'xmark.circle' },
  clearSelection:   { windows: 'ClearSelection',         macos: 'xmark.square' },
  back:             { windows: 'Back',                   macos: 'chevron.left' },
  forward:          { windows: 'Forward',                macos: 'chevron.right' },
  up:               { windows: 'Up',                     macos: 'chevron.up' },
  down:             { windows: 'Download',               macos: 'chevron.down' },
  go:               { windows: 'Go',                     macos: 'arrow.right' },
  goToStart:        { windows: 'GoToStart',              macos: 'backward.end.alt' },
  goToToday:        { windows: 'GoToToday',              macos: 'calendar.day.timeline.leading' },
  home:             { windows: 'Home',                   macos: 'house' },
  search:           { windows: 'Find',                   macos: 'magnifyingglass' },
  find:             { windows: 'Find',                   macos: 'magnifyingglass' },
  settings:         { windows: 'Setting',                macos: 'gearshape' },
  setting:          { windows: 'Setting',                macos: 'gearshape' },
  manage:           { windows: 'Manage',                 macos: 'slider.horizontal.3' },
  repair:           { windows: 'Repair',                 macos: 'wrench.and.screwdriver' },
  refresh:          { windows: 'Refresh',                macos: 'arrow.clockwise' },
  sync:             { windows: 'Sync',                   macos: 'arrow.triangle.2.circlepath' },
  disableUpdates:   { windows: 'DisableUpdates',         macos: 'arrow.clockwise.slash' },
  menu:             { windows: 'GlobalNavigationButton', macos: 'line.3.horizontal' },
  more:             { windows: 'More',                   macos: 'ellipsis' },
  filter:           { windows: 'Filter',                 macos: 'line.3.horizontal.decrease.circle' },
  sort:             { windows: 'Sort',                   macos: 'arrow.up.arrow.down' },
  share:            { windows: 'Share',                  macos: 'square.and.arrow.up' },
  reshare:          { windows: 'ReShare',                macos: 'arrow.2.squarepath' },
  link:             { windows: 'Link',                   macos: 'link' },
  previewLink:      { windows: 'PreviewLink',            macos: 'link.circle' },
  attach:           { windows: 'Attach',                 macos: 'paperclip' },
  print:            { windows: 'Print',                  macos: 'printer' },
  help:             { windows: 'Help',                   macos: 'questionmark.circle' },
  info:             { windows: 'Info',                   macos: 'info.circle' },
  important:        { windows: 'Important',              macos: 'exclamationmark.circle' },
  warning:          { windows: 'Warning',                macos: 'exclamationmark.triangle' },
  error:            { windows: 'Error',                  macos: 'xmark.octagon' },
  bell:             { windows: 'Bell',                   macos: 'bell' },
  priority:         { windows: 'Priority',               macos: 'exclamationmark' },
  flag:             { windows: 'Flag',                   macos: 'flag' },
  pin:              { windows: 'Pin',                    macos: 'pin' },
  unpin:            { windows: 'UnPin',                  macos: 'pin.slash' },
  target:           { windows: 'Target',                 macos: 'scope' },
  switch:           { windows: 'Switch',                 macos: 'arrow.left.arrow.right' },
  switchApps:       { windows: 'SwitchApps',             macos: 'rectangle.2.swap' },
  openWith:         { windows: 'OpenWith',               macos: 'arrow.up.right.square' },
  openLocal:        { windows: 'OpenLocal',              macos: 'arrow.up.doc' },
  postUpdate:       { windows: 'PostUpdate',             macos: 'square.and.pencil' },

  // Clipboard & text editing
  copy:             { windows: 'Copy',                   macos: 'doc.on.doc' },
  cut:              { windows: 'Cut',                    macos: 'scissors' },
  paste:            { windows: 'Paste',                  macos: 'doc.on.clipboard' },
  undo:             { windows: 'Undo',                   macos: 'arrow.uturn.backward' },
  redo:             { windows: 'Redo',                   macos: 'arrow.uturn.forward' },
  selectAll:        { windows: 'SelectAll',              macos: 'selection.pin.in.out' },
  bold:             { windows: 'Bold',                   macos: 'bold' },
  italic:           { windows: 'Italic',                 macos: 'italic' },
  underline:        { windows: 'Underline',              macos: 'underline' },
  font:             { windows: 'Font',                   macos: 'textformat' },
  character:        { windows: 'Character',              macos: 'character' },
  fontSize:         { windows: 'FontSize',               macos: 'textformat.size' },
  fontIncrease:     { windows: 'FontIncrease',           macos: 'textformat.size.larger' },
  fontDecrease:     { windows: 'FontDecrease',           macos: 'textformat.size.smaller' },
  fontColor:        { windows: 'FontColor',              macos: 'paintbrush' },
  highlight:        { windows: 'Highlight',              macos: 'highlighter' },
  alignLeft:        { windows: 'AlignLeft',              macos: 'text.alignleft' },
  alignCenter:      { windows: 'AlignCenter',            macos: 'text.aligncenter' },
  alignRight:       { windows: 'AlignRight',             macos: 'text.alignright' },
  bullets:          { windows: 'Bullets',                macos: 'list.bullet' },
  memo:             { windows: 'Memo',                   macos: 'note.text' },

  // Files, folders & cloud
  folder:           { windows: 'Folder',                 macos: 'folder' },
  newFolder:        { windows: 'NewFolder',              macos: 'folder.badge.plus' },
  moveToFolder:     { windows: 'MoveToFolder',           macos: 'folder.badge.gearshape' },
  syncFolder:       { windows: 'SyncFolder',             macos: 'folder.badge.person.crop' },
  unsyncFolder:     { windows: 'UnsyncFolder',           macos: 'folder.badge.minus' },
  file:             { windows: 'Page',                   macos: 'doc' },
  page:             { windows: 'Page',                   macos: 'doc' },
  page2:            { windows: 'Page2',                  macos: 'doc.fill' },
  twoPage:          { windows: 'TwoPage',                macos: 'book.pages' },
  document:         { windows: 'Document',               macos: 'doc.text' },
  openFile:         { windows: 'OpenFile',               macos: 'doc.badge.arrow.up' },
  protectedDoc:     { windows: 'ProtectedDocument',      macos: 'lock.doc' },
  library:          { windows: 'Library',                macos: 'books.vertical' },
  bookmarks:        { windows: 'Bookmarks',              macos: 'bookmark' },
  bookmark:         { windows: 'Bookmarks',              macos: 'bookmark' },
  tag:              { windows: 'Tag',                    macos: 'tag' },
  cloud:            { windows: 'Cloud',                  macos: 'icloud' },
  download:         { windows: 'Download',               macos: 'arrow.down.circle' },
  upload:           { windows: 'Upload',                 macos: 'arrow.up.circle' },
  import:           { windows: 'Import',                 macos: 'square.and.arrow.down.on.square' },
  importAll:        { windows: 'ImportAll',              macos: 'tray.and.arrow.down' },
  mapDrive:         { windows: 'MapDrive',               macos: 'externaldrive.connected.to.line.below' },
  disconnectDrive:  { windows: 'DisconnectDrive',        macos: 'externaldrive.badge.xmark' },

  // Media, photos & creative
  photos:           { windows: 'Pictures',               macos: 'photo.on.rectangle' },
  pictures:         { windows: 'Pictures',               macos: 'photo.on.rectangle' },
  image:            { windows: 'Pictures',               macos: 'photo' },
  browsePhotos:     { windows: 'BrowsePhotos',           macos: 'photo.stack' },
  slideshow:        { windows: 'SlideShow',              macos: 'play.rectangle' },
  camera:           { windows: 'Camera',                 macos: 'camera' },
  attachCamera:     { windows: 'AttachCamera',           macos: 'camera.on.rectangle' },
  rotateCamera:     { windows: 'RotateCamera',           macos: 'camera.rotate' },
  webcam:           { windows: 'WebCam',                 macos: 'web.camera' },
  video:            { windows: 'Video',                  macos: 'video' },
  play:             { windows: 'Play',                   macos: 'play.fill' },
  pause:            { windows: 'Pause',                  macos: 'pause.fill' },
  stop:             { windows: 'Stop',                   macos: 'stop.fill' },
  next:             { windows: 'Next',                   macos: 'forward.end.fill' },
  previous:         { windows: 'Previous',               macos: 'backward.end.fill' },
  shuffle:          { windows: 'Shuffle',                macos: 'shuffle' },
  repeat:           { windows: 'RepeatAll',              macos: 'repeat' },
  repeatAll:        { windows: 'RepeatAll',              macos: 'repeat' },
  repeatOne:        { windows: 'RepeatOne',              macos: 'repeat.1' },
  audio:            { windows: 'Audio',                  macos: 'music.note' },
  music:            { windows: 'MusicInfo',              macos: 'music.note.list' },
  musicInfo:        { windows: 'MusicInfo',              macos: 'music.note.list' },
  volume:           { windows: 'Volume',                 macos: 'speaker.wave.2.fill' },
  mute:             { windows: 'Mute',                   macos: 'speaker.slash.fill' },
  microphone:       { windows: 'Microphone',             macos: 'mic.fill' },
  caption:          { windows: 'Caption',                macos: 'captions.bubble' },
  closedCaption:    { windows: 'ClosedCaption',          macos: 'captions.bubble.fill' },
  crop:             { windows: 'Crop',                   macos: 'crop' },
  trim:             { windows: 'Trim',                   macos: 'timeline.selection' },
  rotate:           { windows: 'Rotate',                 macos: 'rotate.right' },
  orientation:      { windows: 'Orientation',            macos: 'crop.rotate' },
  scan:             { windows: 'Scan',                   macos: 'scanner' },
  palette:          { windows: 'Palette',                macos: 'paintpalette' },

  // Favorites, ratings & social
  heart:            { windows: 'Heart',                  macos: 'heart' },
  heartFilled:      { windows: 'HeartFill',              macos: 'heart.fill' },
  favorite:         { windows: 'Favorite',               macos: 'heart' },
  unfavorite:       { windows: 'UnFavorite',             macos: 'heart.slash' },
  star:             { windows: 'OutlineStar',            macos: 'star' },
  outlineStar:      { windows: 'OutlineStar',            macos: 'star' },
  starFilled:       { windows: 'SolidStar',              macos: 'star.fill' },
  solidStar:        { windows: 'SolidStar',              macos: 'star.fill' },
  like:             { windows: 'Like',                   macos: 'hand.thumbsup' },
  dislike:          { windows: 'Dislike',                macos: 'hand.thumbsdown' },
  likeDislike:      { windows: 'LikeDislike',            macos: 'hand.thumbsup.circle' },
  emoji:            { windows: 'Emoji',                  macos: 'face.smiling' },
  emoji2:           { windows: 'Emoji2',                 macos: 'face.smiling.inverse' },

  // Places, nature & time
  landscape:        { windows: 'Map',                    macos: 'mountain.2' },
  map:              { windows: 'Map',                    macos: 'map' },
  mapPin:           { windows: 'MapPin',                 macos: 'mappin.and.ellipse' },
  location:         { windows: 'MapPin',                 macos: 'location' },
  directions:       { windows: 'Directions',             macos: 'arrow.triangle.turn.up.right.diamond' },
  street:           { windows: 'Street',                 macos: 'road.lanes' },
  globe:            { windows: 'Globe',                  macos: 'globe' },
  world:            { windows: 'World',                  macos: 'globe.americas' },
  cosmos:           { windows: 'Moon',                   macos: 'moon.stars' },
  moon:             { windows: 'Moon',                   macos: 'moon' },
  sun:              { windows: 'Sun',                    macos: 'sun.max' },
  calendar:         { windows: 'Calendar',               macos: 'calendar' },
  calendarDay:      { windows: 'CalendarDay',            macos: 'calendar.day.timeline.left' },
  calendarWeek:     { windows: 'CalendarWeek',           macos: 'calendar.badge.clock' },
  calendarReply:    { windows: 'CalendarReply',          macos: 'calendar.badge.checkmark' },
  clock:            { windows: 'Clock',                  macos: 'clock' },
  calculator:       { windows: 'Calculator',             macos: 'plus.forwardslash.minus' },
  shop:             { windows: 'Shop',                   macos: 'cart' },

  // People, communication & security
  user:             { windows: 'Contact',                macos: 'person' },
  contact:          { windows: 'Contact',                macos: 'person' },
  contact2:         { windows: 'Contact2',               macos: 'person.crop.circle' },
  contactInfo:      { windows: 'ContactInfo',            macos: 'person.crop.rectangle' },
  contactPresence:  { windows: 'ContactPresence',        macos: 'person.wave.2' },
  otherUser:        { windows: 'OtherUser',              macos: 'person.crop.circle.badge.questionmark' },
  blockContact:     { windows: 'BlockContact',           macos: 'person.slash' },
  account:          { windows: 'Account',                macos: 'person.text.rectangle' },
  users:            { windows: 'People',                 macos: 'person.2' },
  people:           { windows: 'People',                 macos: 'person.2' },
  admin:            { windows: 'Admin',                  macos: 'person.badge.shield.checkmark' },
  permissions:      { windows: 'Permissions',            macos: 'key' },
  key:              { windows: 'Permissions',            macos: 'key' },
  lock:             { windows: 'Lock',                   macos: 'lock' },
  unlock:           { windows: 'Unlock',                 macos: 'lock.open' },
  shield:           { windows: 'Shield',                 macos: 'shield' },
  setLockScreen:    { windows: 'SetLockScreen',          macos: 'lock.display' },
  setTile:          { windows: 'SetTile',                macos: 'square.grid.2x2.fill' },
  mail:             { windows: 'Mail',                   macos: 'envelope' },
  mailFilled:       { windows: 'MailFilled',             macos: 'envelope.fill' },
  mailForward:      { windows: 'MailForward',            macos: 'arrowshape.turn.up.right' },
  reply:            { windows: 'MailReply',              macos: 'arrowshape.turn.up.left' },
  mailReply:        { windows: 'MailReply',              macos: 'arrowshape.turn.up.left' },
  replyAll:         { windows: 'MailReplyAll',           macos: 'arrowshape.turn.up.left.2' },
  mailReplyAll:     { windows: 'MailReplyAll',           macos: 'arrowshape.turn.up.left.2' },
  read:             { windows: 'Read',                   macos: 'envelope.open' },
  showBcc:          { windows: 'ShowBcc',                macos: 'envelope.badge' },
  hideBcc:          { windows: 'HideBcc',                macos: 'envelope.badge.shield.half.filled' },
  send:             { windows: 'Send',                   macos: 'paperplane' },
  message:          { windows: 'Message',                macos: 'message' },
  chat:             { windows: 'Message',                macos: 'bubble.left.and.bubble.right' },
  leaveChat:        { windows: 'LeaveChat',              macos: 'bubble.left.and.exclamationmark.bubble.right' },
  comment:          { windows: 'Comment',                macos: 'text.bubble' },
  phone:            { windows: 'Phone',                  macos: 'phone' },
  phoneBook:        { windows: 'PhoneBook',              macos: 'character.book.closed' },
  hangUp:           { windows: 'HangUp',                 macos: 'phone.down' },
  videoChat:        { windows: 'VideoChat',              macos: 'video.bubble.left' },

  // Layout, window, developer, devices & view
  view:             { windows: 'View',                   macos: 'eye' },
  eye:              { windows: 'View',                   macos: 'eye' },
  eyeOff:           { windows: 'EyeOff',                 macos: 'eye.slash' },
  code:             { windows: 'Code',                   macos: 'chevron.left.forwardslash.chevron.right' },
  terminal:         { windows: 'Terminal',               macos: 'terminal' },
  bug:              { windows: 'Bug',                    macos: 'ladybug' },
  wifi:             { windows: 'Wifi',                   macos: 'wifi' },
  bluetooth:        { windows: 'Bluetooth',              macos: 'dot.radiowaves.left.and.right' },
  battery:          { windows: 'Battery',                macos: 'battery.100' },
  power:            { windows: 'Power',                  macos: 'power' },
  list:             { windows: 'List',                   macos: 'list.bullet' },
  grid:             { windows: 'ViewAll',                macos: 'square.grid.2x2' },
  viewAll:          { windows: 'ViewAll',                macos: 'square.grid.2x2' },
  allApps:          { windows: 'AllApps',                macos: 'square.grid.3x3' },
  showResults:      { windows: 'ShowResults',            macos: 'list.bullet.rectangle' },
  preview:          { windows: 'Preview',                macos: 'rectangle.and.text.magnifyingglass' },
  placeholder:      { windows: 'Placeholder',            macos: 'square.dashed' },
  sidebar:          { windows: 'OpenPane',               macos: 'sidebar.left' },
  openPane:         { windows: 'OpenPane',               macos: 'sidebar.left' },
  closePane:        { windows: 'ClosePane',              macos: 'sidebar.right' },
  newWindow:        { windows: 'NewWindow',              macos: 'macwindow.badge.plus' },
  fullscreen:       { windows: 'FullScreen',             macos: 'arrow.up.left.and.arrow.down.right' },
  backToWindow:     { windows: 'BackToWindow',           macos: 'arrow.down.right.and.arrow.up.left' },
  exitFullscreen:   { windows: 'BackToWindow',           macos: 'arrow.down.right.and.arrow.up.left' },
  zoom:             { windows: 'Zoom',                   macos: 'plus.magnifyingglass' },
  zoomIn:           { windows: 'ZoomIn',                 macos: 'plus.magnifyingglass' },
  zoomOut:          { windows: 'ZoomOut',                macos: 'minus.magnifyingglass' },
  dockLeft:         { windows: 'DockLeft',               macos: 'rectangle.lefthalf.inset.filled' },
  dockRight:        { windows: 'DockRight',              macos: 'rectangle.righthalf.inset.filled' },
  dockBottom:       { windows: 'DockBottom',             macos: 'rectangle.bottomhalf.inset.filled' },
  keyboard:         { windows: 'Keyboard',               macos: 'keyboard' },
  cellPhone:        { windows: 'CellPhone',              macos: 'iphone' },
  touchPointer:     { windows: 'TouchPointer',           macos: 'hand.point.up.left' },
  remote:           { windows: 'Remote',                 macos: 'display' },
  xbox:             { windows: 'XboxOneConsole',         macos: 'gamecontroller' },
  zeroBars:         { windows: 'ZeroBars',               macos: 'cellularbars' },
  oneBar:           { windows: 'OneBar',                 macos: 'cellularbars' },
  twoBars:          { windows: 'TwoBars',                macos: 'cellularbars' },
  threeBars:        { windows: 'ThreeBars',              macos: 'cellularbars' },
  fourBars:         { windows: 'FourBars',               macos: 'cellularbars' },
};

// Case-insensitive lookup tables:
// - BY_UNIVERSAL: universal name -> { windows, macos }
// - WIN_TO_MAC:   Windows Symbol (lowercase) -> macOS SF Symbol
// - MAC_TO_WIN:   macOS SF Symbol (lowercase) -> Windows Symbol
// - WIN_CANONICAL: Windows Symbol (lowercase) -> canonical Windows Symbol
const BY_UNIVERSAL = new Map();
const WIN_TO_MAC = new Map();
const MAC_TO_WIN = new Map();
const WIN_CANONICAL = new Map();

for (const [key, pair] of Object.entries(ICONS)) {
  BY_UNIVERSAL.set(key.toLowerCase(), pair);
  const wLower = pair.windows.toLowerCase();
  const mLower = pair.macos.toLowerCase();
  WIN_CANONICAL.set(wLower, pair.windows);
  if (!WIN_TO_MAC.has(wLower)) WIN_TO_MAC.set(wLower, pair.macos);
  if (!MAC_TO_WIN.has(mLower)) MAC_TO_WIN.set(mLower, pair.windows);
}

// Additional SF Symbol aliases -> Windows Symbol so passing common SF Symbols directly works on Windows.
const EXTRA_MAC_TO_WIN = {
  'eye.fill': 'View',
  'eye.slash': 'HideBcc',
  'heart.fill': 'Favorite',
  'gear': 'Setting',
  'slider.horizontal.3': 'Manage',
  'magnifyingglass.circle': 'Find',
  'plus.circle': 'Add',
  'minus.circle': 'Remove',
  'xmark.circle.fill': 'Clear',
  'checkmark.circle': 'Accept',
  'arrow.left': 'Back',
  'arrow.up': 'Up',
  'arrow.down': 'Download',
  'speaker.wave.3.fill': 'Volume',
  'speaker.fill': 'Volume',
  'mic': 'Microphone',
  'play': 'Play',
  'pause': 'Pause',
  'stop': 'Stop',
  'forward.fill': 'Next',
  'backward.fill': 'Previous',
  'bell': 'Important',
  'bell.fill': 'Important',
  'sparkles': 'SolidStar',
};
for (const [sf, win] of Object.entries(EXTRA_MAC_TO_WIN)) {
  if (!MAC_TO_WIN.has(sf)) MAC_TO_WIN.set(sf, win);
}

/**
 * Resolves an SF Symbol name (including `.fill` / `.circle` / `.square` variants) to a Windows `Symbol` if known.
 */
function sfToWindows(name) {
  const lower = name.toLowerCase();
  if (MAC_TO_WIN.has(lower)) return MAC_TO_WIN.get(lower);
  // Strip common SF Symbol style suffixes (e.g. 'eye.circle.fill' -> 'eye.circle' -> 'eye')
  const parts = lower.split('.');
  while (parts.length > 1) {
    parts.pop();
    const candidate = parts.join('.');
    if (MAC_TO_WIN.has(candidate)) return MAC_TO_WIN.get(candidate);
  }
  return WIN_CANONICAL.get(lower) ?? name;
}

/**
 * Resolves a Windows `Symbol` name to a macOS SF Symbol if known.
 */
function windowsToSf(name) {
  const lower = name.toLowerCase();
  return WIN_TO_MAC.get(lower) ?? name;
}

/**
 * Resolves an icon definition for the target platform (`'windows'` or `'macos'`, or `process.platform`).
 *
 * Goes both ways:
 * - Universal icon name: `'search'`, `'photos'`, `'heart'`, `'eye'`
 * - Direct macOS SF Symbol: `'eye'`, `'magnifyingglass'`, `'photo.on.rectangle'`, `'eye.fill'` -> auto-maps to Windows `Symbol` on Windows
 * - Direct Windows `Symbol`: `'View'`, `'Pictures'`, `'GlobalNavigationButton'` -> auto-maps to SF Symbol on macOS
 * - Platform object: `{ windows: 'Pictures', macos: 'photo.on.rectangle' }` (or `{ win, mac }` / `{ symbol, sf }`)
 * - Prefixed native symbol: `'win:Pictures'`, `'symbol:Pictures'`, `'sf:photo.on.rectangle'`
 */
function resolveSymbol(spec, platform = process.platform) {
  if (!spec) return '';
  const isMac = platform === 'darwin' || platform === 'macos';

  if (typeof spec === 'object') {
    const win = spec.windows ?? spec.win ?? spec.symbol;
    const mac = spec.macos ?? spec.mac ?? spec.sf;
    if (isMac) return mac ?? (win ? windowsToSf(String(win)) : '');
    return win ?? (mac ? sfToWindows(String(mac)) : '');
  }

  const raw = String(spec).trim();
  if (!raw) return '';

  // Explicit native prefixes bypass universal lookup on their target OS and cross-map on the other.
  const prefix = raw.match(/^(win|windows|symbol|sf|macos|mac):(.+)$/i);
  if (prefix) {
    const kind = prefix[1].toLowerCase();
    const name = prefix[2].trim();
    const isSf = kind === 'sf' || kind === 'macos' || kind === 'mac';
    if (isSf) return isMac ? name : sfToWindows(name);
    return !isMac ? (WIN_CANONICAL.get(name.toLowerCase()) ?? name) : windowsToSf(name);
  }

  const lower = raw.toLowerCase();

  // 1. Universal icon name
  const uni = BY_UNIVERSAL.get(lower);
  if (uni) return isMac ? uni.macos : uni.windows;

  // 2. Bidirectional native lookup: Windows Symbol <-> macOS SF Symbol
  return isMac ? windowsToSf(raw) : sfToWindows(raw);
}

module.exports = { ICONS, icons: ICONS, resolveSymbol, sfToWindows, windowsToSf };

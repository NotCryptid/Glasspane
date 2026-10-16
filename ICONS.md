# Glasspane Icons

`Icon(spec)` and `.icon(spec)` (on `Button`, etc.) accept a **universal icon name**, an **explicit per-platform pair**, or a **direct Windows `Symbol` / macOS SF Symbol name**.

```js
const { Icon, Button, icons, resolveSymbol } = require('@cryptidbleh/glasspane');

// 1. Universal icon name (maps to Windows Symbol on Windows and SF Symbols on macOS)
Icon('search').foreground('secondary')
Icon('photos').foreground('accent')
Button('Save', save).icon('save')

// 2. Direct per-platform definition (Windows Symbol + SF Symbol)
Icon({ windows: 'Pictures', macos: 'photo.on.rectangle' })
Icon({ win: 'Map', mac: 'mountain.2' })
Icon({ symbol: 'Globe', sf: 'moon.stars' })
Button('Export', exportFile).icon({ windows: 'SaveLocal', macos: 'arrow.down.doc' })

// 3. Direct native symbol with explicit prefix
Icon('win:GlobalNavigationButton')
Icon('sf:sparkles.rectangle.stack')

// 4. Bidirectional native symbols (Windows Symbol <-> SF Symbols auto-map both ways)
Icon('eye')                   // SF Symbol -> resolves to 'eye' on macOS and 'View' on Windows
Icon('View')                  // Windows Symbol -> resolves to 'View' on Windows and 'eye' on macOS
Icon('eye.fill')              // SF Symbol variant -> 'eye.fill' on macOS, 'View' on Windows
Icon('Pictures')              // Windows Symbol -> 'Pictures' on Windows, 'photo.on.rectangle' on macOS
Icon('photo.on.rectangle')    // SF Symbol -> 'photo.on.rectangle' on macOS, 'Pictures' on Windows
```

---

## How Resolution Works

`resolveSymbol(spec, platform)` resolves icons bidirectionally in the following order:

1. **Per-platform object (`{ windows, macos }` / `{ win, mac }` / `{ symbol, sf }`)** — picks the key for the current OS (`windows` / `win` / `symbol` on Windows, `macos` / `mac` / `sf` on macOS). If only one platform key is given, Glasspane automatically maps it to the other OS.
2. **Prefixed string (`win:<Symbol>`, `symbol:<Symbol>`, `sf:<SFSymbol>`, `mac:<SFSymbol>`)** — uses the exact native symbol on its target OS and cross-maps to the counterpart symbol on the other OS.
3. **Universal icon name** — case-insensitive lookup in `icons` (documented in the tables below).
4. **Bidirectional native Windows `Symbol` <-> SF Symbol lookup** — passing a macOS SF Symbol (such as `'eye'`, `'magnifyingglass'`, `'photo.on.rectangle'`, or variants like `'eye.fill'`) automatically maps to its Windows `Symbol` (`'View'`, `'Find'`, `'Pictures'`) on Windows, and passing a Windows `Symbol` (`'View'`, `'Pictures'`, `'GlobalNavigationButton'`) automatically maps to its macOS SF Symbol on macOS. Any unmapped symbol name is passed straight through to the host.

---

## Universal Icon Reference

All universal names are case-insensitive (`'newFolder'` and `'newfolder'` both work). You can inspect the full table at runtime via `require('@cryptidbleh/glasspane').icons`.

### Navigation & Actions

| Universal Name | Windows `Symbol` | macOS SF Symbol |
|---|---|---|
| `add` / `plus` | `Add` | `plus` |
| `remove` / `minus` | `Remove` | `minus` |
| `delete` / `trash` | `Delete` | `trash` |
| `edit` | `Edit` | `pencil` |
| `rename` | `Rename` | `pencil.and.outline` |
| `save` | `Save` | `square.and.arrow.down` |
| `saveLocal` | `SaveLocal` | `arrow.down.doc` |
| `check` / `accept` | `Accept` | `checkmark` |
| `close` / `cancel` | `Cancel` | `xmark` |
| `clear` | `Clear` | `xmark.circle` |
| `back` | `Back` | `chevron.left` |
| `forward` | `Forward` | `chevron.right` |
| `up` | `Up` | `chevron.up` |
| `down` | `Download` | `chevron.down` |
| `go` | `Go` | `arrow.right` |
| `home` | `Home` | `house` |
| `search` / `find` | `Find` | `magnifyingglass` |
| `settings` / `setting` | `Setting` | `gearshape` |
| `manage` | `Manage` | `slider.horizontal.3` |
| `repair` | `Repair` | `wrench.and.screwdriver` |
| `refresh` | `Refresh` | `arrow.clockwise` |
| `sync` | `Sync` | `arrow.triangle.2.circlepath` |
| `menu` | `GlobalNavigationButton` | `line.3.horizontal` |
| `more` | `More` | `ellipsis` |
| `filter` | `Filter` | `line.3.horizontal.decrease.circle` |
| `sort` | `Sort` | `arrow.up.arrow.down` |
| `share` | `Share` | `square.and.arrow.up` |
| `reshare` | `ReShare` | `arrow.2.squarepath` |
| `link` | `Link` | `link` |
| `attach` | `Attach` | `paperclip` |
| `print` | `Print` | `printer` |
| `help` | `Help` | `questionmark.circle` |
| `info` | `Info` | `info.circle` |
| `warning` | `Warning` | `exclamationmark.triangle` |
| `error` | `Error` | `xmark.octagon` |
| `bell` / `notification` | `Bell` | `bell` |
| `flag` | `Flag` | `flag` |
| `pin` | `Pin` | `pin` |
| `unpin` | `UnPin` | `pin.slash` |

### Clipboard & Text Editing

| Universal Name | Windows `Symbol` | macOS SF Symbol |
|---|---|---|
| `copy` | `Copy` | `doc.on.doc` |
| `cut` | `Cut` | `scissors` |
| `paste` | `Paste` | `doc.on.clipboard` |
| `undo` | `Undo` | `arrow.uturn.backward` |
| `redo` | `Redo` | `arrow.uturn.forward` |
| `selectAll` | `SelectAll` | `selection.pin.in.out` |
| `bold` | `Bold` | `bold` |
| `italic` | `Italic` | `italic` |
| `underline` | `Underline` | `underline` |
| `font` | `Font` | `textformat` |
| `fontSize` | `FontSize` | `textformat.size` |
| `fontIncrease` | `FontIncrease` | `textformat.size.larger` |
| `fontDecrease` | `FontDecrease` | `textformat.size.smaller` |
| `fontColor` | `FontColor` | `paintbrush` |
| `highlight` | `Highlight` | `highlighter` |
| `alignLeft` | `AlignLeft` | `text.alignleft` |
| `alignCenter` | `AlignCenter` | `text.aligncenter` |
| `alignRight` | `AlignRight` | `text.alignright` |
| `bullets` | `Bullets` | `list.bullet` |

### Files, Folders & Cloud

| Universal Name | Windows `Symbol` | macOS SF Symbol |
|---|---|---|
| `folder` | `Folder` | `folder` |
| `newFolder` | `NewFolder` | `folder.badge.plus` |
| `moveToFolder` | `MoveToFolder` | `folder.badge.gearshape` |
| `syncFolder` | `SyncFolder` | `folder.badge.person.crop` |
| `file` | `Page` | `doc` |
| `document` | `Document` | `doc.text` |
| `openFile` | `OpenFile` | `doc.badge.arrow.up` |
| `protectedDoc` | `ProtectedDocument` | `lock.doc` |
| `library` | `Library` | `books.vertical` |
| `bookmark` / `bookmarks` | `Bookmarks` | `bookmark` |
| `tag` | `Tag` | `tag` |
| `cloud` | `Cloud` | `icloud` |
| `download` | `Download` | `arrow.down.circle` |
| `upload` | `Upload` | `arrow.up.circle` |
| `import` | `Import` | `square.and.arrow.down.on.square` |

### Media, Photos & Creative

| Universal Name | Windows `Symbol` | macOS SF Symbol |
|---|---|---|
| `photos` / `pictures` | `Pictures` | `photo.on.rectangle` |
| `image` | `Pictures` | `photo` |
| `browsePhotos` | `BrowsePhotos` | `photo.stack` |
| `slideshow` | `SlideShow` | `play.rectangle` |
| `camera` | `Camera` | `camera` |
| `rotateCamera` | `RotateCamera` | `camera.rotate` |
| `webcam` | `WebCam` | `web.camera` |
| `video` | `Video` | `video` |
| `play` | `Play` | `play.fill` |
| `pause` | `Pause` | `pause.fill` |
| `stop` | `Stop` | `stop.fill` |
| `next` | `Next` | `forward.end.fill` |
| `previous` | `Previous` | `backward.end.fill` |
| `shuffle` | `Shuffle` | `shuffle` |
| `repeat` | `RepeatAll` | `repeat` |
| `repeatOne` | `RepeatOne` | `repeat.1` |
| `audio` | `Audio` | `music.note` |
| `music` | `MusicInfo` | `music.note.list` |
| `volume` | `Volume` | `speaker.wave.2.fill` |
| `mute` | `Mute` | `speaker.slash.fill` |
| `microphone` | `Microphone` | `mic.fill` |
| `crop` | `Crop` | `crop` |
| `trim` | `Trim` | `timeline.selection` |
| `rotate` | `Rotate` | `rotate.right` |
| `palette` | `Palette` | `paintpalette` |

### Favorites, Ratings & Social

| Universal Name | Windows `Symbol` | macOS SF Symbol |
|---|---|---|
| `heart` | `Heart` | `heart` |
| `heartFilled` | `HeartFill` | `heart.fill` |
| `favorite` | `Favorite` | `heart` |
| `unfavorite` | `UnFavorite` | `heart.slash` |
| `star` | `OutlineStar` | `star` |
| `starFilled` | `SolidStar` | `star.fill` |
| `like` | `Like` | `hand.thumbsup` |
| `dislike` | `Dislike` | `hand.thumbsdown` |
| `emoji` | `Emoji` | `face.smiling` |

### Places, Nature & Time

| Universal Name | Windows `Symbol` | macOS SF Symbol |
|---|---|---|
| `landscape` | `Map` | `mountain.2` |
| `map` | `Map` | `map` |
| `mapPin` | `MapPin` | `mappin.and.ellipse` |
| `location` | `MapPin` | `location` |
| `directions` | `Directions` | `arrow.triangle.turn.up.right.diamond` |
| `street` | `Street` | `road.lanes` |
| `globe` | `Globe` | `globe` |
| `world` | `World` | `globe.americas` |
| `cosmos` | `Moon` | `moon.stars` |
| `moon` | `Moon` | `moon` |
| `sun` | `Sun` | `sun.max` |
| `calendar` | `Calendar` | `calendar` |
| `calendarDay` | `CalendarDay` | `calendar.day.timeline.left` |
| `calendarWeek` | `CalendarWeek` | `calendar.badge.clock` |
| `clock` | `Clock` | `clock` |
| `calculator` | `Calculator` | `plus.forwardslash.minus` |
| `shop` | `Shop` | `cart` |

### People, Communication & Security

| Universal Name | Windows `Symbol` | macOS SF Symbol |
|---|---|---|
| `user` | `Contact` | `person` |
| `contact` | `Contact` | `person.crop.circle` |
| `account` | `Account` | `person.text.rectangle` |
| `users` / `people` | `People` | `person.2` |
| `admin` | `Admin` | `person.badge.shield.checkmark` |
| `permissions` / `key` | `Permissions` | `key` |
| `lock` | `Lock` | `lock` |
| `unlock` | `Unlock` | `lock.open` |
| `shield` | `Shield` | `shield` |
| `mail` | `Mail` | `envelope` |
| `mailFilled` | `MailFilled` | `envelope.fill` |
| `reply` | `MailReply` | `arrowshape.turn.up.left` |
| `replyAll` | `MailReplyAll` | `arrowshape.turn.up.left.2` |
| `send` | `Send` | `paperplane` |
| `message` | `Message` | `message` |
| `chat` | `Message` | `bubble.left.and.bubble.right` |
| `comment` | `Comment` | `text.bubble` |
| `phone` | `Phone` | `phone` |
| `hangUp` | `HangUp` | `phone.down` |
| `videoChat` | `VideoChat` | `video.bubble.left` |

### Layout, Window & View

| Universal Name | Windows `Symbol` | macOS SF Symbol |
|---|---|---|
| `list` | `List` | `list.bullet` |
| `grid` / `viewAll` | `ViewAll` | `square.grid.2x2` |
| `allApps` | `AllApps` | `square.grid.3x3` |
| `view` / `eye` | `View` | `eye` |
| `preview` | `Preview` | `rectangle.and.text.magnifyingglass` |
| `sidebar` / `openPane` | `OpenPane` | `sidebar.left` |
| `closePane` | `ClosePane` | `sidebar.right` |
| `newWindow` | `NewWindow` | `macwindow.badge.plus` |
| `fullscreen` | `FullScreen` | `arrow.up.left.and.arrow.down.right` |
| `exitFullscreen` | `BackToWindow` | `arrow.down.right.and.arrow.up.left` |
| `zoom` | `Zoom` | `plus.magnifyingglass` |
| `zoomIn` | `ZoomIn` | `plus.magnifyingglass` |
| `zoomOut` | `ZoomOut` | `minus.magnifyingglass` |
| `dockLeft` | `DockLeft` | `rectangle.lefthalf.inset.filled` |
| `dockRight` | `DockRight` | `rectangle.righthalf.inset.filled` |
| `dockBottom` | `DockBottom` | `rectangle.bottomhalf.inset.filled` |
| `keyboard` | `Keyboard` | `keyboard` |
| `cellPhone` | `CellPhone` | `iphone` |
| `remote` | `Remote` | `display` |


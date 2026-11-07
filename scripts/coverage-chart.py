"""Draws coverage_windows.png and coverage_macos.png: one tile per WinUI control / SwiftUI view.

F = Glasspane has a view for it, N = reachable on Windows through Native(), . = not covered.
Edit the tables below when the hosts change, then run: python scripts/coverage-chart.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
COLORS = {'F': (40, 178, 62), 'N': (22, 105, 48), '.': (110, 110, 118)}
BG = (14, 14, 18)

# group -> [(element, status)]
WINUI = {
    'Buttons': [('Button', 'F'), ('HyperlinkButton', 'F'), ('DropDownButton', 'F'), ('ToggleButton', 'N'), ('RepeatButton', 'N'),
                ('SplitButton', 'N'), ('ToggleSplitButton', 'N'), ('RadioButton', 'N'), ('AppBarButton', 'N'), ('AppBarToggleButton', 'N')],
    'Text': [('TextBlock', 'F'), ('TextBox', 'F'), ('PasswordBox', 'F'), ('AutoSuggestBox', 'F'), ('NumberBox', 'F'),
             ('RichEditBox', 'N'), ('RichTextBlock', 'N'), ('PersonPicture', 'N')],
    'Selection': [('CheckBox', 'F'), ('ToggleSwitch', 'F'), ('RadioButtons', 'F'), ('ComboBox', 'F'), ('SelectorBar', 'F'), ('Slider', 'F'),
                  ('ListView', 'F'), ('ListBox', 'N'), ('GridView', 'N'), ('FlipView', 'N'), ('TreeView', 'N'), ('ItemsView', 'N'),
                  ('RatingControl', 'N'), ('PipsPager', 'N'), ('RadioMenuFlyoutItem', 'N')],
    'Layout': [('Grid', 'F'), ('StackPanel', 'F'), ('ScrollViewer', 'F'), ('Border', 'F'), ('SplitView', 'F'), ('Expander', 'F'),
               ('Canvas', 'N'), ('RelativePanel', 'N'), ('ItemsRepeater', 'N'), ('ScrollView', 'N'), ('Viewbox', 'N'), ('VariableSizedWrapGrid', 'N')],
    'Date, color': [('CalendarDatePicker', 'F'), ('TimePicker', 'F'), ('ColorPicker', 'F'), ('DatePicker', 'N'), ('CalendarView', 'N')],
    'Status, media': [('ProgressBar', 'F'), ('ProgressRing', 'F'), ('Image', 'F'), ('InfoBar', 'N'), ('InfoBadge', 'N'), ('WebView2', 'F'),
                      ('MediaPlayerElement', 'F'), ('AnimatedVisualPlayer', 'N'), ('ParallaxView', 'N')],
    'Navigation': [('TabView', 'F'), ('MenuBar', 'F'), ('NavigationView', 'N'), ('BreadcrumbBar', 'N'), ('CommandBar', 'N'),
                   ('Pivot', 'N'), ('TitleBar', 'N'), ('CommandBarFlyout', '.')],
    'Overlays': [('Flyout', 'F'), ('ContentDialog', 'F'), ('MenuFlyout', 'F'), ('TeachingTip', 'N'), ('ToolTip', 'N'), ('Popup', 'N'),
                 ('TextCommandBarFlyout', '.'), ('SwipeControl', 'N'), ('RefreshContainer', 'N'), ('AppBarSeparator', 'N')],
    'Icons, shapes': [('FontIcon', 'F'), ('SymbolIcon', 'F'), ('Rectangle', 'F'), ('Ellipse', 'F'), ('BitmapIcon', 'N'), ('PathIcon', 'N'),
                      ('Line', 'N'), ('Polygon', 'N'), ('Polyline', 'N'), ('Path', 'N'), ('ImageIcon', 'N')],
}

SWIFTUI = {
    'Stacks, layout': [('VStack', 'F'), ('HStack', 'F'), ('ZStack', 'F'), ('ScrollView', 'F'), ('Grid', 'F'), ('GridRow', 'F'), ('Spacer', 'F'),
                       ('Divider', 'F'), ('LazyVStack', 'F'), ('LazyHStack', '.'), ('LazyVGrid', '.'), ('LazyHGrid', '.'),
                       ('GeometryReader', '.'), ('ViewThatFits', '.'), ('Group', '.'), ('AnyLayout', '.')],
    'Controls': [('Button', 'F'), ('Toggle', 'F'), ('Slider', 'F'), ('Stepper', 'F'), ('Picker', 'F'), ('DatePicker', 'F'), ('ColorPicker', 'F'),
                 ('Menu', 'F'), ('Link', 'F'), ('DisclosureGroup', 'F'), ('ControlGroup', '.'), ('Gauge', 'F'), ('PasteButton', '.'),
                 ('ShareLink', '.'), ('EditButton', '.'), ('TimelineView', '.'), ('MultiDatePicker', '.')],
    'Text, input': [('Text', 'F'), ('Label', 'F'), ('TextField', 'F'), ('SecureField', 'F'), ('TextEditor', 'F'), ('SearchField', 'F'),
                    ('LabeledContent', '.'), ('TextFieldLink', '.')],
    'Lists, nav': [('List', 'F'), ('ForEach', 'F'), ('TabView', 'F'), ('NavigationSplitView', 'F'), ('Section', 'F'), ('Table', '.'),
                   ('OutlineGroup', '.'), ('NavigationStack', 'F'), ('NavigationLink', '.'), ('Form', 'F'), ('ScrollViewReader', '.')],
    'Content': [('Image', 'F'), ('SF Symbol', 'F'), ('ProgressView', 'F'), ('AsyncImage', 'F'), ('Canvas', '.'), ('Map', '.'), ('WebView', 'F'),
                ('VideoPlayer', 'F'), ('TimelineSchedule', '.'), ('ContentUnavailableView', '.')],
    'Shapes': [('Rectangle', 'F'), ('RoundedRectangle', 'F'), ('Circle', 'F'), ('Ellipse', 'F'), ('Capsule', 'F'), ('Path', '.'),
               ('UnevenRoundedRectangle', '.'), ('LinearGradient', 'F'), ('RadialGradient', 'F'), ('AngularGradient', '.')],
    'Presentation': [('popover', 'F'), ('sheet', 'F'), ('contextMenu', 'F'), ('alert', '.'), ('fullScreenCover', '.'),
                     ('confirmationDialog', '.'), ('inspector', '.'), ('toolbar', '.'), ('searchable', '.')],
}


def font(size, bold=False):
    names = ['segoeuib.ttf', 'seguisb.ttf'] if bold else ['segoeui.ttf']
    for n in names + ['/System/Library/Fonts/SFNS.ttf', 'DejaVuSans.ttf']:
        try:
            return ImageFont.truetype(n, size)
        except OSError:
            pass
    return ImageFont.load_default()


def squarify(items, x, y, w, h):
    """items: [(weight, payload)] sorted descending. Returns [(payload, x, y, w, h)]."""
    out = []
    total = sum(i[0] for i in items)
    items = [(i[0] * w * h / total, i[1]) for i in items]
    while items:
        short = min(w, h)
        row, area = [], 0
        best = float('inf')
        for k in range(1, len(items) + 1):
            cand = items[:k]
            a = sum(c[0] for c in cand)
            side = a / short
            worst = max(max(side * side / c[0], c[0] / (side * side)) for c in cand)
            if worst > best:
                break
            best, row, area = worst, cand, a
        items = items[len(row):]
        side = area / short
        pos = 0
        for a, payload in row:
            span = a / side
            if w >= h:
                out.append((payload, x, y + pos, side, span))
            else:
                out.append((payload, x + pos, y, span, side))
            pos += span
        if w >= h:
            x, w = x + side, w - side
        else:
            y, h = y + side, h - side
    return out


def draw_group(d, name, elems, x, y, w, h, gap=2):
    d.rectangle([x, y, x + w, y + h], fill=BG)
    label_h = 20
    d.text((x + 5, y + 2), name, font=font(14, True), fill=(255, 255, 255))
    ix, iy, iw, ih = x + 1, y + label_h, w - 2, h - label_h - 1
    n = len(elems)
    best = None
    for cols in range(1, n + 1):
        rows = -(-n // cols)
        cell = min(iw / cols, ih / rows)
        if best is None or cell > best[0]:
            best = (cell, cols, rows)
    _, cols, rows = best
    cw, ch = iw / cols, ih / rows
    elems = sorted(elems, key=lambda e: 'FN.'.index(e[1]))
    for i, (el, st) in enumerate(elems):
        cx, cy = ix + (i % cols) * cw, iy + (i // cols) * ch
        d.rectangle([cx + 1, cy + 1, cx + cw - 1, cy + ch - 1], fill=COLORS[st])
        f = font(11)
        t = el
        while d.textlength(t, font=f) > cw - 6 and len(t) > 3:
            t = t[:-2]
        if t != el:
            t = t.rstrip() + '…'
        if ch > 15:
            d.text((cx + 4, cy + ch / 2 - 7), t, font=f, fill=(255, 255, 255) if st != '.' else (225, 225, 230))


def render(title, data, path, native_note):
    W, H, top = 1100, 700, 44
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    total = sum(len(v) for v in data.values())
    first = sum(1 for v in data.values() for _, s in v if s == 'F')
    nat = sum(1 for v in data.values() for _, s in v if s == 'N')
    covered = first + nat
    head = f'{title}: {covered / total:.1%} ({covered}/{total})'
    d.text((8, 4), head, font=font(26, True), fill=(255, 255, 255))
    legend = [(COLORS['F'], f'Glasspane view ({first})')]
    if nat:
        legend.append((COLORS['N'], f'via Native() ({nat})'))
    legend.append((COLORS['.'], f'not covered ({total - covered})'))
    lx = W - 8
    for col, text in reversed(legend):
        tw = d.textlength(text, font=font(13))
        lx -= tw
        d.text((lx, 14), text, font=font(13), fill=(210, 210, 215))
        lx -= 18
        d.rectangle([lx, 16, lx + 12, 28], fill=col)
        lx -= 14
    groups = sorted(data.items(), key=lambda kv: -len(kv[1]))
    for (name, elems), gx, gy, gw, gh in squarify([(len(e), (n, e)) for n, e in groups], 0, top, W, H - top):
        draw_group(d, name, elems, gx, gy, gw, gh)
    img.save(path)
    return head


if __name__ == '__main__':
    print(render('WinUI 3 controls', WINUI, os.path.join(OUT, 'coverage_windows.png'), True))
    print(render('SwiftUI views', SWIFTUI, os.path.join(OUT, 'coverage_macos.png'), False))

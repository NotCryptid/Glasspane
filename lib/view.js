'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { isBinding } = require('./state');
const { resolveSymbol } = require('./icons');

// Presets follow each platform's own type scale: the Fluent type ramp on Windows (nothing below
// 12px) and the system text styles on macOS (13pt body, nothing below 10pt).
const FONT_PRESETS = process.platform === 'darwin' ? {
  largeTitle: { size: 26, weight: 600 },
  title: { size: 22, weight: 600 },
  title2: { size: 17, weight: 600 },
  title3: { size: 15, weight: 600 },
  headline: { size: 13, weight: 700 },
  subheadline: { size: 11, weight: 400 },
  body: { size: 13, weight: 400 },
  callout: { size: 12, weight: 400 },
  caption: { size: 10, weight: 400 },
  caption2: { size: 10, weight: 500 },
  mono: { size: 13, family: 'Menlo' },
} : {
  largeTitle: { size: 40, weight: 600 },
  title: { size: 28, weight: 600 },
  title2: { size: 20, weight: 600 },
  title3: { size: 18, weight: 600 },
  headline: { size: 14, weight: 600 },
  subheadline: { size: 14, weight: 400 },
  body: { size: 14, weight: 400 },
  callout: { size: 14, weight: 400 },
  caption: { size: 12, weight: 400 },
  caption2: { size: 12, weight: 400 },
  mono: { size: 14, family: 'Cascadia Mono' },
};

const WEIGHTS = {
  thin: 100, extraLight: 200, light: 300, normal: 400, regular: 400,
  medium: 500, semibold: 600, bold: 700, extraBold: 800, black: 900,
};

function edges(v, fallback = 16) {
  if (v === undefined || v === true) return fallback;
  if (typeof v === 'number') return v;
  if (Array.isArray(v)) return v.length === 4 ? v : [v[1] ?? 0, v[0] ?? 0, v[1] ?? 0, v[0] ?? 0];
  const h = v.horizontal ?? v.x ?? 0;
  const vt = v.vertical ?? v.y ?? 0;
  return [v.leading ?? v.left ?? h, v.top ?? vt, v.trailing ?? v.right ?? h, v.bottom ?? vt];
}

/**
 * An immutable description of a piece of UI. Modifiers return a new View, so a View can be
 * stored in a variable and reused with different modifiers.
 */
class View {
  constructor(type, props = {}, children = [], events = {}, overlays = {}) {
    this.type = type;
    this.props = props;
    this.children = children;
    this.events = events;
    /** Views that hang off this one but are not its children: popover, sheet, contextMenu. */
    this.overlays = overlays;
  }

  with(props, events) {
    const merged = { ...this.props, ...props };
    let ev = this.events;
    if (events) {
      ev = { ...ev };
      for (const [k, fn] of Object.entries(events)) ev[k] = [...(ev[k] || []), fn];
    }
    return new View(this.type, merged, this.children, ev, this.overlays);
  }

  withOverlay(name, content, props, events) {
    const v = this.with(props, events);
    return new View(v.type, v.props, v.children, v.events, { ...v.overlays, [name]: content });
  }

  // ---- layout
  padding(v) { return this.with({ padding: edges(v) }); }
  margin(v) { return this.with({ margin: edges(v) }); }
  frame(a, b) {
    const o = typeof a === 'object' && a !== null ? a : { width: a, height: b };
    const p = {};
    for (const k of ['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight']) {
      if (o[k] === Infinity) p[k === 'maxWidth' || k === 'width' ? 'hAlign' : 'vAlign'] = 'stretch';
      else if (o[k] !== undefined) p[k] = o[k];
    }
    return this.with(p);
  }
  width(n) { return this.frame({ width: n }); }
  height(n) { return this.frame({ height: n }); }
  minWidth(n) { return this.frame({ minWidth: n }); }
  minHeight(n) { return this.frame({ minHeight: n }); }
  maxWidth(n) { return this.frame({ maxWidth: n }); }
  maxHeight(n) { return this.frame({ maxHeight: n }); }
  fill() { return this.with({ hAlign: 'stretch', vAlign: 'stretch' }); }
  fillWidth() { return this.with({ hAlign: 'stretch' }); }
  fillHeight() { return this.with({ vAlign: 'stretch' }); }
  /** Take a share of the leftover space in a stack (like a Spacer that holds content). */
  flex(n = 1) { return this.with({ flex: n }); }

  // ---- text
  font(f) {
    if (typeof f === 'number') return this.with({ fontSize: f });
    if (typeof f === 'string') {
      const preset = FONT_PRESETS[f];
      if (!preset) throw new Error(`Unknown font "${f}". Use one of: ${Object.keys(FONT_PRESETS).join(', ')} or a size.`);
      return this.with({ fontSize: preset.size, fontWeight: preset.weight, fontFamily: preset.family });
    }
    const p = {};
    if (f.size !== undefined) p.fontSize = f.size;
    if (f.weight !== undefined) p.fontWeight = WEIGHTS[f.weight] ?? f.weight;
    if (f.italic !== undefined) p.italic = f.italic;
    if (f.family !== undefined) p.fontFamily = f.family;
    return this.with(p);
  }
  fontWeight(w) { return this.with({ fontWeight: WEIGHTS[w] ?? w }); }
  bold() { return this.with({ fontWeight: 700 }); }
  italic(on = true) { return this.with({ italic: on }); }

  // ---- appearance
  foreground(color) { return this.with({ foreground: color }); }
  background(color) { return this.with({ background: color }); }
  border(color = 'divider', width = 1) { return this.with({ border: { color, width } }); }
  cornerRadius(r) { return this.with({ cornerRadius: r }); }
  opacity(o) { return this.with({ opacity: o }); }
  /** A translucent glass surface (Liquid Glass on macOS) with this corner radius. Ignored on Windows. */
  glass(radius = 24) { return this.with({ glass: radius }); }
  disabled(on = true) { return this.with({ disabled: on }); }
  hidden(on = true) { return this.with({ hidden: on }); }
  tooltip(text) { return this.with({ tooltip: text }); }
  /** Outline a shape (Rectangle, Circle, ...). */
  stroke(color = 'primary', width = 1) { return this.with({ stroke: { color, width } }); }
  /** Shift the view without changing the layout around it. */
  offset(x = 0, y = 0) { return this.with({ offsetX: x, offsetY: y }); }
  /** Rotate around the center, in degrees. */
  rotation(degrees) { return this.with({ rotation: degrees }); }
  /** Scale around the center. One number scales both axes. */
  scale(x, y = x) { return this.with({ scaleX: x, scaleY: y }); }
  /** Stacking order among siblings in a ZStack. Higher is in front. */
  zIndex(n) { return this.with({ zIndex: n }); }
  /** With false the view and its children ignore the pointer. */
  hitTesting(on = true) { return this.with({ hitTesting: on }); }
  accessibilityLabel(s) { return this.with({ a11yLabel: s }); }
  accessibilityHint(s) { return this.with({ a11yHint: s }); }
  underline(on = true) { return this.with({ underline: on }); }
  strikethrough(on = true) { return this.with({ strikethrough: on }); }
  /** Extra space between characters, in points. */
  tracking(n) { return this.with({ tracking: n }); }
  /** A keyboard shortcut for a Button, such as 'CmdOrCtrl+S'. */
  shortcut(spec) { return this.with({ shortcut: spec }); }
  /** A check mark on a MenuItem. */
  checked(on = true) { return this.with({ checked: on }); }

  // ---- behavior
  /** Stable identity so focus and scroll survive reordering. ForEach sets this for you. */
  id(key) { return this.with({ id: key }); }
  onTap(fn) { return this.with({}, { tap: fn }); }
  onChange(fn) { return this.with({}, { change: fn }); }
  onSubmit(fn) { return this.with({}, { submit: fn }); }
  onDoubleTap(fn) { return this.with({}, { doubleTap: fn }); }
  /** Called with true when the pointer enters the view and false when it leaves. */
  onHover(fn) { return this.with({}, { hover: fn }); }
  /** A right-click (long press) menu: contextMenu(MenuItem(...), Divider(), Menu('More', ...)). */
  contextMenu(...items) { return this.withOverlay('contextMenu', items); }
  /**
   * A small floating panel next to the view, open while `isOpen` is true. Closing it from the
   * outside sets a bound state back to false.
   *   .popover(open, { edge: 'bottom' }, Text('Hello'))
   */
  popover(isOpen, ...content) {
    const opts = content.length && isPlainProps(content[0]) ? content.shift() : {};
    return this.withOverlay('popover', content, { popoverOpen: !!read(isOpen), popoverEdge: opts.edge },
      { popoverDismiss: () => { if (isBinding(isOpen)) isOpen.value = false; } });
  }
  /** A modal panel over the window, open while `isOpen` is true. Put a button inside that sets it back to false. */
  sheet(isOpen, ...content) {
    return this.withOverlay('sheet', content, { sheetOpen: !!read(isOpen) },
      { sheetDismiss: () => { if (isBinding(isOpen)) isOpen.value = false; } });
  }
  /** Subscribe to any WinUI event by name (Native views). */
  on(eventName, fn) { return this.with({}, { [eventName]: fn }); }
  /** Set any raw property. */
  prop(name, value) { return this.with({ [name]: value }); }
  /**
   * What to show where this view does not exist. A Native() control is WinUI only, so on macOS
   * `.fallback(view)` renders `view` instead. On Windows this view is kept.
   */
  fallback(view) { return process.platform === 'darwin' ? view : this; }

  // ---- per-view options, all just named props
  spacing(n) { return this.with({ spacing: n }); }
  alignment(a) { return this.with({ alignment: a }); }
  hAlign(a) { return this.with({ hAlign: a }); }
  vAlign(a) { return this.with({ vAlign: a }); }
  textAlign(a) { return this.with({ textAlign: a }); }
  lineLimit(n) { return this.with({ lineLimit: n }); }
  selectable(on = true) { return this.with({ selectable: on }); }
  placeholder(s) { return this.with({ placeholder: s }); }
  label(s) { return this.with({ label: s }); }
  icon(name) { return this.with({ icon: resolveSymbol(name) }); }
  /** Button style: 'accent' for the filled accent look. */
  style(s) { return this.with({ style: s }); }
  axis(a) { return this.with({ axis: a }); }
  fit(f) { return this.with({ fit: f }); }
  readOnly(on = true) { return this.with({ readOnly: on }); }
  ring() { return this.with({ style: 'ring' }); }
  /** List selection: binds the selected index. */
  selection(binding) {
    const v = this.with({ selected: binding.value });
    return v.with({}, { select: (i) => { binding.value = i; } });
  }
}

// ------------------------------------------------------------------ constructors

const isPlainProps = (x) =>
  x !== null && typeof x === 'object' && !(x instanceof View) && !Array.isArray(x) && !isBinding(x);

function container(type) {
  return (...args) => {
    const props = args.length && isPlainProps(args[0]) ? args.shift() : {};
    return new View(type, { ...props }, args);
  };
}

const VStack = container('VStack');
const HStack = container('HStack');
const ZStack = container('ZStack');

function single(type) {
  return (...args) => {
    const props = args.length && isPlainProps(args[0]) ? args.shift() : {};
    return new View(type, { ...props }, args);
  };
}

const ScrollView = single('ScrollView');
const Card = single('Card');

/** A symbol: a universal icon name ('search', 'photos'), a { windows, macos } pair, or a direct Windows Symbol / SF Symbol name. */
const Icon = (name) => new View('Icon', { name: resolveSymbol(name) });

const Spacer = (minLength) => new View('Spacer', minLength ? { minHeight: minLength, minWidth: minLength } : {});
const Divider = () => new View('Divider');

const read = (x) => (isBinding(x) ? x.value : x);
const Text = (value) => new View('Text', { text: value == null ? '' : String(read(value)) });

function Button(label, action) {
  const v = new View('Button', { text: label == null ? undefined : String(read(label)) });
  return action ? v.on('click', action) : v;
}

/** Wires a binding to a view: writes the current value and registers the change handler. */
function bind(view, binding, valueProp, toView = (x) => x, fromView = (x) => x) {
  if (isBinding(binding)) {
    return view.with({ [valueProp]: toView(binding.value) }, { change: (v) => { binding.value = fromView(v); } });
  }
  return view.with({ [valueProp]: toView(binding) });
}

function textInput(type) {
  return (placeholder, binding) => {
    if (isBinding(placeholder) || (binding === undefined && typeof placeholder !== 'string')) {
      binding = placeholder;
      placeholder = undefined;
    }
    return bind(new View(type, { placeholder }), binding, 'text', (x) => (x == null ? '' : String(x)));
  };
}

const TextField = textInput('TextField');
const SecureField = textInput('SecureField');
const TextEditor = textInput('TextEditor');

const Toggle = (label, binding) => bind(new View('Toggle', { label }), binding, 'value', Boolean);
const Checkbox = (label, binding) => bind(new View('Checkbox', { label }), binding, 'value', Boolean);

function Slider(binding, opts = {}) {
  return bind(new View('Slider', { min: 0, max: 100, step: 1, ...opts }), binding, 'value', Number);
}

function Stepper(label, binding, opts = {}) {
  return bind(new View('Stepper', { label, ...opts }), binding, 'value', Number);
}

function Picker(label, binding, options) {
  const opts = options.map((o) => (o !== null && typeof o === 'object' ? o : { label: String(o), value: o }));
  const view = new View('Picker', { label, options: opts.map((o) => o.label) });
  const selected = opts.findIndex((o) => o.value === read(binding));
  const v = view.with({ selected });
  return isBinding(binding) ? v.with({}, { change: (i) => { binding.value = opts[i].value; } }) : v;
}

const ProgressView = (value) => new View('ProgressView', value === undefined ? {} : { value: Number(read(value)) });
const Spinner = () => ProgressView().ring();

const REMOTE = /^(https?|file|ms-appx|ms-appdata|data):/i;
function Image(source, opts = {}) {
  const src = source == null ? undefined : REMOTE.test(source) ? source : pathToFileURL(path.resolve(source)).href;
  return new View('Image', { source: src, ...opts });
}

/**
 * List(items, render) builds a selectable list. List(view, view, ...) works too.
 * Lists fill the space they are given.
 */
function List(a, b, c) {
  const kids = Array.isArray(a) && typeof b === 'function' ? ForEach(a, b, c) : [a, b, c].filter((x) => x !== undefined);
  return new View('List', { flex: 1 }, kids);
}

/** ForEach(items, (item, i) => View, { key: item => ... }) -> array of keyed views. */
function ForEach(items, render, opts = {}) {
  const keyOf = opts.key || ((item) => (item !== null && typeof item === 'object' && item.id !== undefined ? item.id : undefined));
  return items.map((item, i) => {
    let v = render(item, i);
    if (typeof v === 'string') v = Text(v);
    const k = keyOf(item, i);
    return k === undefined ? v : v.id(String(k));
  });
}


// ---- views with a counterpart in both SwiftUI and WinUI

/** An icon next to text. */
const Label = (text, icon) => new View('Label', { text: text == null ? '' : String(read(text)), icon: icon === undefined ? undefined : resolveSymbol(icon) });

/** A hyperlink that opens in the default browser. */
const Link = (text, url) => new View('Link', { text: text == null ? '' : String(read(text)), url: String(url) });

const toMs = (d) => (d instanceof Date ? d.getTime() : typeof d === 'number' ? d : new Date(d).getTime());

/**
 * Picks a date (`mode: 'date'`, the default) or a time of day (`mode: 'time'`). The bound value is
 * a Date, and picking a date keeps the time of day it already had.
 */
function DatePicker(label, binding, opts = {}) {
  const props = { label, mode: opts.mode === 'time' ? 'time' : 'date' };
  if (opts.min !== undefined) props.min = toMs(opts.min);
  if (opts.max !== undefined) props.max = toMs(opts.max);
  return bind(new View('DatePicker', props), binding, 'value', toMs, (ms) => new Date(ms));
}

/** Picks a color. The bound value is '#RRGGBB', or '#AARRGGBB' once the user picks a translucent one. */
const ColorPicker = (label, binding, opts = {}) =>
  bind(new View('ColorPicker', { label, alpha: !!opts.alpha }), binding, 'value', String);

const SearchField = textInput('SearchField');

/**
 * A collapsible section. Pass `{ expanded: state }` first to control it from your code.
 *   DisclosureGroup('Advanced', Text('Hidden until opened'))
 */
function DisclosureGroup(label, ...args) {
  const opts = args.length && isPlainProps(args[0]) ? args.shift() : {};
  const { expanded, ...props } = opts;
  let v = new View('DisclosureGroup', { label, ...props }, args);
  if (expanded !== undefined) v = bind(v, expanded, 'expanded', Boolean);
  return v;
}

/** One page of a TabView. */
const Tab = (label, ...content) => new View('Tab', { text: label }, content);

/** Tabs. `TabView(selectedIndex, Tab('One', ...), Tab('Two', ...))`; the index is optional. */
function TabView(...args) {
  const binding = args.length && !(args[0] instanceof View) && !Array.isArray(args[0]) ? args.shift() : undefined;
  const v = new View('TabView', { flex: 1 }, args);
  return binding === undefined ? v : bind(v, binding, 'selected', Number);
}

/** A sidebar beside a detail pane. `SplitView(sidebar, detail, { sidebarWidth: 240 })`. */
const SplitView = (sidebar, detail, opts = {}) => new View('SplitView', { sidebarWidth: 240, flex: 1, ...opts }, [sidebar, detail]);

/** An entry in a Menu or contextMenu. Chain .icon(), .checked(), .shortcut(), .disabled(). */
const MenuItem = (label, action) => {
  const v = new View('MenuItem', { text: label == null ? '' : String(read(label)) });
  return action ? v.on('click', action) : v;
};

/** A button that opens a menu. Entries are MenuItem, Divider and nested Menu views. */
const Menu = (label, ...items) => new View('Menu', { text: label == null ? '' : String(read(label)) }, items);

/** Rows of cells that share columns. `Grid(GridRow(a, b), GridRow(c, d))`. */
const GridRow = (...cells) => new View('GridRow', {}, cells);

function flattenChildren(list, out = []) {
  for (const c of list) {
    if (Array.isArray(c)) flattenChildren(c, out);
    else if (c !== null && c !== undefined && c !== false && c !== true) out.push(c);
  }
  return out;
}

function Grid(...args) {
  const props = args.length && isPlainProps(args[0]) ? args.shift() : {};
  const rows = flattenChildren(args);
  for (const r of rows) {
    if (!(r instanceof View) || r.type !== 'GridRow') throw new Error('Grid holds GridRow views. Wrap each row in GridRow(...).');
  }
  const cells = rows.map((r) => flattenChildren(r.children));
  return new View('Grid', { ...props, rows: cells.map((c) => c.length) }, cells.flat());
}

// Shapes fill with foreground() and outline with stroke().
const Rectangle = () => new View('Rectangle');
const RoundedRectangle = (radius = 8) => new View('RoundedRectangle', { radius });
const Circle = () => new View('Circle');
const Ellipse = () => new View('Ellipse');
const Capsule = () => new View('Capsule');

const POINTS = {
  top: [0.5, 0], bottom: [0.5, 1], leading: [0, 0.5], trailing: [1, 0.5], center: [0.5, 0.5],
  topLeading: [0, 0], topTrailing: [1, 0], bottomLeading: [0, 1], bottomTrailing: [1, 1],
};

/**
 * A color ramp for background() and foreground().
 *   .background(LinearGradient(['#ff5f6d', '#ffc371'], 'topLeading', 'bottomTrailing'))
 * Stops are colors, or { color, at } with `at` from 0 to 1.
 */
function LinearGradient(stops, from = 'top', to = 'bottom') {
  if (!Array.isArray(stops) || stops.length < 2) throw new Error('LinearGradient needs at least two colors.');
  const point = (p) => {
    const xy = Array.isArray(p) ? p : POINTS[p];
    if (!xy) throw new Error(`Unknown gradient point "${p}". Use one of: ${Object.keys(POINTS).join(', ')} or [x, y].`);
    return xy;
  };
  return {
    gradient: {
      stops: stops.map((s, i) => (typeof s === 'string' ? { color: s, at: i / (stops.length - 1) } : s)),
      start: point(from),
      end: point(to),
    },
  };
}

// ---- views built from the ones above, so they look native on both platforms

/**
 * A titled group of rows on a card, like a settings group. Rows are separated by dividers.
 *   Section('Account', Toggle('Sync', sync), Picker('Plan', plan, ['Free', 'Pro']))
 */
function Section(title, ...children) {
  const rows = [];
  flattenChildren(children).forEach((row, i) => { if (i) rows.push(Divider()); rows.push(row); });
  return VStack({ alignment: 'leading', spacing: 6 },
    title == null ? null : Text(title).font('caption').bold().foreground('secondary'),
    Card(VStack({ alignment: 'leading', spacing: 10 }, ...rows).padding(12))
      .background('card').border('divider', 1).cornerRadius(8 * cornerMultiplier()));
}

/** A column of Sections. */
const Form = (...children) => VStack({ alignment: 'leading', spacing: 16 }, ...children);

const cornerMultiplier = () => (process.platform === 'darwin' ? 1 : 1 / 3);

/**
 * A stack of pages with a Back button. `pages` is a state holding an array of functions that
 * return a View. Push with `pages.update((p) => p.push(() => Detail(id)))` and pop with
 * `pages.update((p) => p.pop())`. Pages are functions so they re-render with your state.
 *   NavigationStack(pages, () => Home())
 */
function NavigationStack(pages, root, opts = {}) {
  const stack = read(pages) || [];
  const page = (f) => (typeof f === 'function' ? f() : f);
  if (!stack.length) return page(root);
  const back = Button(opts.backLabel || 'Back', () => {
    if (isBinding(pages)) pages.update((p) => { p.pop(); });
  }).icon('back').style('plain');
  return VStack({ alignment: 'leading', spacing: 8 },
    HStack({ spacing: 8 }, back, opts.title === undefined ? null : Text(opts.title).bold()),
    page(stack[stack.length - 1]).flex(1));
}

/** A labeled level meter: `Gauge('Battery', 0.7)` or `Gauge('Disk', used, { min: 0, max: 512 })`. */
function Gauge(label, value, opts = {}) {
  const min = opts.min ?? 0;
  const max = opts.max ?? 1;
  const v = Number(read(value));
  const shown = opts.format ? opts.format(v) : String(Math.round(v * 100) / 100);
  return VStack({ alignment: 'leading', spacing: 4 },
    HStack(Text(label), Spacer(), Text(shown).foreground('secondary')),
    ProgressView(Math.min(Math.max((v - min) / (max - min || 1), 0), 1)));
}

/**
 * A list that creates its rows as they scroll into view, for long collections. Rows are not
 * selectable. Pass items and a render function, or the rows themselves.
 *   LazyVStack(files, (f) => Text(f.name))
 */
function LazyVStack(a, b, c) {
  const kids = Array.isArray(a) && typeof b === 'function' ? ForEach(a, b, c) : [a, b, c].filter((x) => x !== undefined);
  return new View('List', { flex: 1, plain: true }, kids);
}

/** A web page: `WebView('https://example.com')` or `WebView({ html: '<h1>Hi</h1>' })`. */
function WebView(source) {
  const props = source !== null && typeof source === 'object' ? { html: String(source.html ?? '') } : { url: String(source) };
  return new View('WebView', { minHeight: 200, flex: 1, ...props });
}

/** A video with transport controls. `source` is a file path or a URL. */
function VideoPlayer(source, opts = {}) {
  const src = REMOTE.test(source) ? source : pathToFileURL(path.resolve(source)).href;
  return new View('VideoPlayer', { source: src, minHeight: 180, flex: 1, autoplay: !!opts.autoplay });
}

/**
 * A color ramp that radiates from a point, for background() and foreground().
 * `radius` is a fraction of the view (0.5 reaches the nearest edge from the center).
 */
function RadialGradient(stops, center = 'center', radius = 0.5) {
  if (!Array.isArray(stops) || stops.length < 2) throw new Error('RadialGradient needs at least two colors.');
  const xy = Array.isArray(center) ? center : POINTS[center];
  if (!xy) throw new Error(`Unknown gradient point "${center}". Use one of: ${Object.keys(POINTS).join(', ')} or [x, y].`);
  return {
    gradient: {
      type: 'radial',
      stops: stops.map((s, i) => (typeof s === 'string' ? { color: s, at: i / (stops.length - 1) } : s)),
      center: xy,
      radius,
    },
  };
}

/**
 * Escape hatch for any WinUI control, e.g.
 *   Native('Expander', { Header: 'More', IsExpanded: true }, Text('Hello'))
 *   Native('CalendarDatePicker').on('DateChanged', d => ...)
 * Property values are converted (enum names, colors, numbers, thickness).
 */
function Native(type, props = {}, ...children) {
  return new View('Native', { type, props }, children);
}

module.exports = {
  View, VStack, HStack, ZStack, ScrollView, Card, Spacer, Divider, Text, Button,
  TextField, SecureField, TextEditor, Toggle, Checkbox, Slider, Stepper, Picker,
  ProgressView, Spinner, Image, Icon, List, ForEach, Native,
  Label, Link, DatePicker, ColorPicker, SearchField, DisclosureGroup, Tab, TabView, SplitView,
  MenuItem, Menu, Grid, GridRow, Rectangle, RoundedRectangle, Circle, Ellipse, Capsule, LinearGradient,
  Section, Form, NavigationStack, Gauge, LazyVStack, WebView, VideoPlayer, RadialGradient,
  flattenChildren,
};

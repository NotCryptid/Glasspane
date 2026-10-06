'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { isBinding } = require('./state');

const FONT_PRESETS = {
  largeTitle: { size: 40, weight: 600 },
  title: { size: 28, weight: 600 },
  title2: { size: 22, weight: 600 },
  title3: { size: 18, weight: 600 },
  headline: { size: 16, weight: 600 },
  subheadline: { size: 14, weight: 400 },
  body: { size: 14, weight: 400 },
  callout: { size: 14, weight: 400 },
  caption: { size: 12, weight: 400 },
  caption2: { size: 11, weight: 400 },
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
  const h = v.horizontal ?? 0;
  const vt = v.vertical ?? 0;
  return [v.leading ?? v.left ?? h, v.top ?? vt, v.trailing ?? v.right ?? h, v.bottom ?? vt];
}

/**
 * An immutable description of a piece of UI. Modifiers return a new View, so a View can be
 * stored in a variable and reused with different modifiers.
 */
class View {
  constructor(type, props = {}, children = [], events = {}) {
    this.type = type;
    this.props = props;
    this.children = children;
    this.events = events;
  }

  with(props, events) {
    const merged = { ...this.props, ...props };
    let ev = this.events;
    if (events) {
      ev = { ...ev };
      for (const [k, fn] of Object.entries(events)) ev[k] = [...(ev[k] || []), fn];
    }
    return new View(this.type, merged, this.children, ev);
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

  // ---- behavior
  /** Stable identity so focus and scroll survive reordering. ForEach sets this for you. */
  id(key) { return this.with({ id: key }); }
  onTap(fn) { return this.with({}, { tap: fn }); }
  onChange(fn) { return this.with({}, { change: fn }); }
  onSubmit(fn) { return this.with({}, { submit: fn }); }
  /** Subscribe to any WinUI event by name (Native views). */
  on(eventName, fn) { return this.with({}, { [eventName]: fn }); }
  /** Set any raw property. */
  prop(name, value) { return this.with({ [name]: value }); }

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
  icon(name) { return this.with({ icon: name }); }
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

/** A symbol: a Windows Symbol name (e.g. 'Home') or, on macOS, any SF Symbol name. Size and color follow font() and foreground(). */
const Icon = (name) => new View('Icon', { name });

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
};

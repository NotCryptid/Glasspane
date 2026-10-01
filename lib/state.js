'use strict';

// The runtime registers a function here that schedules a re-render.
let invalidate = () => {};
const setInvalidator = (fn) => { invalidate = fn; };
const requestRender = (changed) => invalidate(changed);

// While a window builds its tree, every bound value it reads is recorded, so a state change only
// re-renders the windows that actually depend on it.
let tracking = null;
const track = () => (tracking = new Set());
const untrack = () => { const t = tracking; tracking = null; return t; };
const note = (owner) => { if (tracking) tracking.add(owner); };

/**
 * Observable value. Setting `.value` re-renders the app. Pass one to an input view
 * (TextField, Toggle, Slider, ...) and it is two-way bound, like SwiftUI's `$binding`.
 */
class State {
  constructor(initial) {
    this._v = initial;
  }
  get value() { note(this); return this._v; }
  set value(next) {
    if (Object.is(next, this._v)) return;
    this._v = next;
    requestRender(this);
  }
  set(next) { this.value = next; }
  /** `count.update(n => n + 1)`. Also fine to mutate an object in place and return nothing. */
  update(fn) {
    const r = fn(this._v);
    this._v = r === undefined ? this._v : r;
    requestRender(this);
  }
  toggle() { this.value = !this._v; }
  valueOf() { note(this); return this._v; }
  toString() { note(this); return String(this._v); }
  get isBinding() { return true; }
}

/** A binding over anything: `Binding(() => user.name, v => { user.name = v; })`. */
function Binding(get, set) {
  return {
    get isBinding() { return true; },
    get value() { note(this); return get(); },
    set value(v) { set(v); requestRender(this); },
  };
}

const state = (initial) => new State(initial);
const isBinding = (x) => x != null && typeof x === 'object' && x.isBinding === true;

module.exports = { State, state, Binding, isBinding, setInvalidator, requestRender, track, untrack };

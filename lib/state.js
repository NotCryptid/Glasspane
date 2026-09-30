'use strict';

// The runtime registers a function here that schedules a re-render.
let invalidate = () => {};
const setInvalidator = (fn) => { invalidate = fn; };
const requestRender = () => invalidate();

/**
 * Observable value. Setting `.value` re-renders the app. Pass one to an input view
 * (TextField, Toggle, Slider, ...) and it is two-way bound, like SwiftUI's `$binding`.
 */
class State {
  constructor(initial) {
    this._v = initial;
  }
  get value() { return this._v; }
  set value(next) {
    if (Object.is(next, this._v)) return;
    this._v = next;
    requestRender();
  }
  set(next) { this.value = next; }
  /** `count.update(n => n + 1)`. Also fine to mutate an object in place and return nothing. */
  update(fn) {
    const r = fn(this._v);
    this._v = r === undefined ? this._v : r;
    requestRender();
  }
  toggle() { this.value = !this._v; }
  valueOf() { return this._v; }
  toString() { return String(this._v); }
  get isBinding() { return true; }
}

/** A binding over anything: `Binding(() => user.name, v => { user.name = v; })`. */
function Binding(get, set) {
  return {
    get isBinding() { return true; },
    get value() { return get(); },
    set value(v) { set(v); requestRender(); },
  };
}

const state = (initial) => new State(initial);
const isBinding = (x) => x != null && typeof x === 'object' && x.isBinding === true;

module.exports = { State, state, Binding, isBinding, setInvalidator, requestRender };

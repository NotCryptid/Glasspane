'use strict';

const { View, Text, flattenChildren } = require('./view');

// Properties a parent passes down to its children unless they set their own (SwiftUI "environment").
const INHERITED = ['foreground', 'fontSize', 'fontWeight', 'italic', 'fontFamily', 'disabled'];
const CONTAINERS = new Set(['VStack', 'HStack', 'ZStack', 'ScrollView', 'Card', 'List', 'Native', 'DisclosureGroup', 'Tab', 'TabView', 'SplitView', 'Grid']);

const flatten = flattenChildren;
// These hold exactly one child; several children get an implicit VStack.
const SINGLE = new Set(['Card', 'ScrollView', 'DisclosureGroup', 'Tab']);

/**
 * Turns a View tree into the JSON wire format. Event handlers are replaced by ids derived from
 * the node's position (or key), so an id stays valid across renders while the tree shape is stable.
 */
function serialize(view, handlers, path = 'r', inherited = {}) {
  if (!(view instanceof View)) view = Text(view);

  const props = { ...view.props };
  const key = props.id;
  delete props.id;

  const childInherit = { ...inherited };
  for (const k of INHERITED) {
    if (props[k] !== undefined) childInherit[k] = props[k];
    else if (inherited[k] !== undefined && !CONTAINERS.has(view.type)) props[k] = inherited[k];
  }
  if (CONTAINERS.has(view.type)) for (const k of INHERITED) delete props[k];

  const node = { t: view.type };
  if (key !== undefined) node.k = key;
  if (Object.keys(props).length) node.p = props;

  const events = Object.entries(view.events);
  if (events.length) {
    node.e = {};
    for (const [name, fns] of events) {
      const id = `${path}:${name}`;
      node.e[name] = id;
      handlers.set(id, (value) => {
        let result;
        for (const fn of fns) result = fn(value);
        return result;
      });
    }
  }

  let kids = flatten(view.children);
  // Several children of a single-child view get an implicit VStack that takes the
  // spacing/alignment set on the view itself.
  if (SINGLE.has(view.type) && kids.length > 1) {
    const inner = { alignment: props.alignment ?? 'leading' };
    if (props.spacing !== undefined) inner.spacing = props.spacing;
    kids = [new View('VStack', inner, kids)];
    delete props.alignment;
    delete props.spacing;
    if (node.p) { delete node.p.alignment; delete node.p.spacing; if (!Object.keys(node.p).length) delete node.p; }
  }
  if (kids.length) {
    node.c = kids.map((child, i) => {
      const k = child instanceof View ? child.props.id : undefined;
      return serialize(child, handlers, `${path}/${k !== undefined ? '#' + k : i}`, childInherit);
    });
  }

  const overlays = Object.entries(view.overlays || {});
  if (overlays.length) {
    node.o = {};
    for (const [name, content] of overlays) {
      let list = flatten(content);
      // A menu is a list of entries; a popover or sheet is one view.
      if (name !== 'contextMenu' && list.length !== 1) list = [new View('VStack', {}, list)];
      node.o[name] = list.map((child, i) => serialize(child, handlers, `${path}/o:${name}/${i}`, childInherit));
      if (name !== 'contextMenu') node.o[name] = node.o[name][0];
    }
  }
  return node;
}

module.exports = { serialize };

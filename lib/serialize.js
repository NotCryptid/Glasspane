'use strict';

const { View, Text } = require('./view');

// Properties a parent passes down to its children unless they set their own (SwiftUI "environment").
const INHERITED = ['foreground', 'fontSize', 'fontWeight', 'italic', 'fontFamily', 'disabled'];
const CONTAINERS = new Set(['VStack', 'HStack', 'ZStack', 'ScrollView', 'Card', 'List', 'Native']);

function flatten(list, out = []) {
  for (const c of list) {
    if (Array.isArray(c)) flatten(c, out);
    else if (c !== null && c !== undefined && c !== false && c !== true) out.push(c);
  }
  return out;
}

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
  // Card and ScrollView hold one child; several children get an implicit VStack that takes
  // the spacing/alignment set on the Card itself.
  if ((view.type === 'Card' || view.type === 'ScrollView') && kids.length > 1) {
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
  return node;
}

module.exports = { serialize };

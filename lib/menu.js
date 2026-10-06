'use strict';

// Window menus. An app describes its menu bar once and both hosts build the native thing: an NSMenu
// on macOS, a MenuBar at the top of the window on Windows. Clicks come back through the same handler
// ids as view events. This module turns the description into plain JSON for the hosts: it fills in
// standard items (Undo, Copy, ...), picks shortcuts for the platform and swaps functions for ids.

const MAC = process.platform === 'darwin';

// Standard items. The host runs the action; `accel` is what the shortcut would be on this platform.
const ROLES = {
  undo: { label: 'Undo', accel: 'CmdOrCtrl+Z' },
  redo: { label: 'Redo', accel: MAC ? 'Cmd+Shift+Z' : 'Ctrl+Y' },
  cut: { label: 'Cut', accel: 'CmdOrCtrl+X' },
  copy: { label: 'Copy', accel: 'CmdOrCtrl+C' },
  paste: { label: 'Paste', accel: 'CmdOrCtrl+V' },
  selectAll: { label: 'Select All', accel: 'CmdOrCtrl+A' },
  minimize: { label: 'Minimize', accel: MAC ? 'Cmd+M' : undefined },
  zoom: { label: MAC ? 'Zoom' : 'Maximize' },
  fullscreen: { label: 'Enter Full Screen', accel: MAC ? 'Ctrl+Cmd+F' : 'F11' },
  close: { label: MAC ? 'Close' : 'Close Window', accel: MAC ? 'Cmd+W' : 'Ctrl+W' },
  quit: { label: MAC ? 'Quit' : 'Exit', accel: MAC ? 'Cmd+Q' : undefined },
};

// Shorthand for whole menus: `menu: ['edit', 'view', 'window']`.
const STANDARD_MENUS = {
  edit: { label: 'Edit', items: [{ role: 'undo' }, { role: 'redo' }, '-', { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
  view: { label: 'View', items: [{ role: 'fullscreen' }] },
  window: { label: 'Window', items: [{ role: 'minimize' }, { role: 'zoom' }] },
  help: { label: 'Help', items: [], help: true },
};

/**
 * @param spec  an array of menus, or a function returning one, so a menu can read `state` and
 *              stay in step with it (a checkmark, a disabled item).
 * @param register  stores a click handler and returns its id.
 * @returns the JSON for the hosts, or undefined when the app has no menu.
 */
function resolveMenu(spec, register) {
  const list = typeof spec === 'function' ? spec() : spec;
  if (!Array.isArray(list)) return undefined;
  return list.flat().filter(Boolean).map((m) => {
    const menu = typeof m === 'string' ? STANDARD_MENUS[m] : m;
    if (!menu) throw new Error(`Unknown standard menu '${m}'. Use 'edit', 'view', 'window' or 'help', or { label, items }.`);
    if (!menu.label) throw new Error('A menu needs a label.');
    const out = { label: menu.label, items: items(menu.items || [], register) };
    if (menu.help) out.help = true;
    return out;
  });
}

function items(list, register) {
  return list.flat().filter(Boolean).map((it) => {
    if (it === '-' || it.separator) return { separator: true };
    if (it.role && !ROLES[it.role]) throw new Error(`Unknown menu role '${it.role}'.`);
    const base = it.role ? ROLES[it.role] : {};
    const label = it.label ?? base.label;
    if (!label) throw new Error('A menu item needs a label or a role.');
    const out = { label };
    if (it.role) out.role = it.role;
    const accel = it.shortcut ?? base.accel;
    if (accel) out.accel = accel;
    if (it.enabled === false) out.enabled = false;
    if (it.checked !== undefined) out.checked = !!it.checked;
    if (it.items) out.items = items(it.items, register);
    else if (typeof it.onClick === 'function') out.click = register(it.onClick);
    return out;
  });
}

module.exports = { resolveMenu };

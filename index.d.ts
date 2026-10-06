export type Color =
  | 'accent' | 'primary' | 'secondary' | 'tertiary' | 'disabled' | 'card' | 'surface' | 'control'
  | 'background' | 'divider' | 'danger' | 'success' | 'warning'
  | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'teal' | 'gray'
  | 'black' | 'white' | 'clear'
  | (string & {}); // '#RGB', '#RRGGBB', '#AARRGGBB'

export type FontPreset =
  | 'largeTitle' | 'title' | 'title2' | 'title3' | 'headline' | 'subheadline'
  | 'body' | 'callout' | 'caption' | 'caption2' | 'mono';
export type FontWeight = 'thin' | 'extraLight' | 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'extraBold' | 'black' | number;
export type Align = 'start' | 'center' | 'end' | 'stretch' | 'leading' | 'trailing' | 'top' | 'bottom';
export type Edges = number | [number, number] | { horizontal?: number; vertical?: number; top?: number; bottom?: number; leading?: number; trailing?: number; left?: number; right?: number };

/** Two-way bindable value. Pass it to TextField, Toggle, Slider, ... */
export interface Bindable<T> { value: T }

export class State<T> implements Bindable<T> {
  constructor(initial: T);
  value: T;
  set(next: T): void;
  /** Return a new value, or mutate in place and return nothing. Always re-renders. */
  update(fn: (current: T) => T | void): void;
  toggle(this: State<boolean>): void;
}
export function state<T>(initial: T): State<T>;
export function Binding<T>(get: () => T, set: (v: T) => void): Bindable<T>;

export type Child = View | string | number | null | undefined | false | Child[];

export class View {
  readonly type: string;
  // layout
  padding(v?: Edges): View;
  margin(v?: Edges): View;
  frame(size: { width?: number; height?: number; minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number }): View;
  frame(width: number, height?: number): View;
  width(n: number): View;
  height(n: number): View;
  minWidth(n: number): View;
  minHeight(n: number): View;
  maxWidth(n: number): View;
  maxHeight(n: number): View;
  fill(): View;
  fillWidth(): View;
  fillHeight(): View;
  /** Share leftover space inside a stack. */
  flex(weight?: number): View;
  hAlign(a: Align): View;
  vAlign(a: Align): View;
  // text
  font(f: FontPreset | number | { size?: number; weight?: FontWeight; italic?: boolean; family?: string }): View;
  fontWeight(w: FontWeight): View;
  bold(): View;
  italic(on?: boolean): View;
  textAlign(a: 'start' | 'center' | 'end'): View;
  lineLimit(n: number): View;
  selectable(on?: boolean): View;
  // appearance
  foreground(c: Color): View;
  background(c: Color): View;
  border(color?: Color, width?: number): View;
  cornerRadius(r: number): View;
  opacity(o: number): View;
  /** A translucent glass surface (Liquid Glass on macOS) with this corner radius. Ignored on Windows. */
  glass(radius?: number): View;
  disabled(on?: boolean): View;
  hidden(on?: boolean): View;
  tooltip(text: string): View;
  // behavior
  id(key: string | number): View;
  onTap(fn: () => void): View;
  onChange(fn: (value: any) => void): View;
  onSubmit(fn: (value: string) => void): View;
  /** Subscribe to a WinUI event by name; most useful on Native views. */
  on(eventName: string, fn: (value?: any) => void): View;
  prop(name: string, value: unknown): View;
  // per-view options
  spacing(n: number): View;
  alignment(a: Align | 'topLeading' | 'topTrailing' | 'bottomLeading' | 'bottomTrailing'): View;
  placeholder(s: string): View;
  label(s: string): View;
  /** A Symbol name such as 'Add', 'Delete', 'Save', 'Setting'. */
  icon(name: string): View;
  /** 'accent' for buttons, 'ring' for progress, 'plain' for a borderless TextField (macOS). */
  style(s: 'accent' | 'ring' | 'plain' | (string & {})): View;
  axis(a: 'vertical' | 'horizontal' | 'both'): View;
  fit(f: 'fit' | 'fill' | 'cover' | 'none'): View;
  readOnly(on?: boolean): View;
  ring(): View;
  selection(binding: Bindable<number>): View;
}

type Props = { spacing?: number; alignment?: Align; [k: string]: unknown };
type Stack = { (props: Props, ...children: Child[]): View; (...children: Child[]): View };

export const VStack: Stack;
export const HStack: Stack;
export const ZStack: Stack;
export const ScrollView: Stack;
export const Card: Stack;
export function Spacer(minLength?: number): View;
export function Divider(): View;
export function Text(value: string | number | Bindable<unknown>): View;
export function Button(label: string, action?: () => void | Promise<void>): View;
export function TextField(placeholder: string, value: Bindable<string> | string): View;
export function TextField(value: Bindable<string> | string): View;
export const SecureField: typeof TextField;
export const TextEditor: typeof TextField;
export function Toggle(label: string, value: Bindable<boolean> | boolean): View;
export function Checkbox(label: string, value: Bindable<boolean> | boolean): View;
export function Slider(value: Bindable<number> | number, opts?: { min?: number; max?: number; step?: number; label?: string }): View;
export function Stepper(label: string, value: Bindable<number> | number, opts?: { min?: number; max?: number; step?: number }): View;
export function Picker<T>(label: string, value: Bindable<T> | T, options: Array<T | { label: string; value: T }>): View;
/** value in 0...1, omit for an indeterminate bar. */
export function ProgressView(value?: number | Bindable<number>): View;
export function Spinner(): View;
/** A symbol: a Windows Symbol name (e.g. 'Home') or, on macOS, any SF Symbol name. Size and color follow font() and foreground(). */
export function Icon(name: string): View;
export function Image(source: string, opts?: { fit?: 'fit' | 'fill' | 'cover' | 'none' }): View;
export function List<T>(items: T[], render: (item: T, index: number) => Child, opts?: { key?: (item: T, i: number) => string | number }): View;
export function List(...children: Child[]): View;
export function ForEach<T>(items: T[], render: (item: T, index: number) => View | string, opts?: { key?: (item: T, i: number) => string | number }): View[];
/** Any WinUI control by type name, e.g. Native('Expander', { Header: 'More' }, child). Windows only: it renders nothing on macOS. */
export function Native(type: string, props?: Record<string, unknown>, ...children: Child[]): View;

export interface WindowOptions {
  title?: string;
  width?: number;
  height?: number;
  backdrop?: 'mica' | 'micaAlt' | 'acrylic' | 'none';
  theme?: 'system' | 'light' | 'dark';
  /** 'hidden' runs the content up to the window's top edge. The macOS traffic lights or the Windows caption buttons float over it: keep `system.titleBarInsets` clear of your own controls. */
  titleBar?: 'standard' | 'hidden';
  /** Corner radius of a window with a hidden title bar, in points. Default 26. A sidebar inset by d points looks right with radius minus d. macOS only. */
  cornerRadius?: number;
  /** Path to a square PNG (512px or larger is best) or an .ico/.icns file, relative to your script. It is the title bar and taskbar icon on Windows and the Dock icon on macOS. */
  icon?: string;
  /** The window's menu bar: the macOS menu bar, or a bar at the top of the window on Windows. Pass a function to read `state` (checkmarks, disabled items); it runs again on every render. */
  menu?: MenuSpec | (() => MenuSpec);
}

/** `'edit'`, `'view'`, `'window'` and `'help'` stand for the usual menus of that name. */
export type MenuSpec = Array<'edit' | 'view' | 'window' | 'help' | MenuDef | false | null | undefined>;
export interface MenuDef { label: string; items: MenuEntry[] }
/** `'-'` is a separator. Falsy entries are skipped, so `cond && item` works. */
export type MenuEntry = MenuItem | '-' | false | null | undefined;
export interface MenuItem {
  /** Defaults to the standard label of `role`. */
  label?: string;
  onClick?: () => void | Promise<void>;
  /** A standard item that the host runs itself. Edit items act on the focused text field. */
  role?: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll' | 'minimize' | 'zoom' | 'fullscreen' | 'close' | 'quit';
  /** `'CmdOrCtrl+N'`, `'Shift+Alt+F5'`. CmdOrCtrl is Command on macOS and Ctrl on Windows. */
  shortcut?: string;
  enabled?: boolean;
  /** Shows a checkmark. */
  checked?: boolean;
  /** A submenu. */
  items?: MenuEntry[];
}

/** The `system` API. On the global `system`, calls act on the focused window. */
export interface SystemApi {
  alert(message: string, opts?: { title?: string; buttons?: string[] }): Promise<number>;
  confirm(message: string, opts?: { title?: string; ok?: string; cancel?: string }): Promise<boolean>;
  openFile(opts?: { extensions?: string[]; multiple?: false }): Promise<string | null>;
  openFile(opts: { extensions?: string[]; multiple: true }): Promise<string[]>;
  saveFile(opts?: { name?: string; extensions?: string[]; description?: string }): Promise<string | null>;
  pickFolder(): Promise<string | null>;
  clipboard: { read(): Promise<string | null>; write(text: string): Promise<void> };
  launch(uri: string): Promise<boolean>;
  /** Closes every window. The process exits once the last one is gone. */
  quit(): void;
  /** Space the system keeps at the sides of a hidden title bar, in points: the traffic lights on the left on macOS, the caption buttons on the right on Windows. */
  titleBarInsets: { left: number; right: number };
  /** Live window settings: `system.window.title = 'Saved'`. Affects the focused window. */
  window: WindowOptions;
}

/** One window, as returned by `App()`. Its `system` calls are bound to that window. */
export interface AppWindow extends SystemApi {
  /** Numeric id used to route messages to this window. */
  readonly id: number;
  /** This window's own settings. */
  window: WindowOptions;
  /** Close just this window. The process stays alive while others are open. */
  close(): void;
}

/** Opens a window. Call it more than once for a multi-window app. */
export function App(title: string, body: () => Child): AppWindow;
export function App(options: WindowOptions, body: () => Child): AppWindow;

export const system: SystemApi & {
  /** The OS the app is running on. */
  readonly platform: 'windows' | 'macos';
  /** The `system` API bound to one window: `system.windowOf(win).confirm(...)`. */
  windowOf(win: AppWindow): SystemApi;
};

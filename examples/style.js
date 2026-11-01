// The look every example shares: macOS 26 and Windows 11, from the same code. This is the only
// place the examples ask which platform they run on.
//
// Both platforms agree on the rules the examples follow: Liquid Glass is for floating controls
// (the sidebar and search field in photos.js), not for content, so grouped content sits on plain
// cards. Spacing is in multiples of 4. Text is left-aligned. Actions sit at the top, not the bottom.
const { system, Card } = require('..');

const MAC = system.platform === 'macos';

module.exports = {
  /** Corner radius multipliers: macOS-scale radii in the code, Fluent-scale ones on Windows. */
  R: system.cornerRadiusMultiplier,
  RS: system.softCornerRadiusMultiplier,

  /**
   * Window options. macOS 26 runs the content up under a transparent title bar with the traffic
   * lights floating over it. Windows keeps its standard title bar and Mica backdrop.
   */
  chrome: MAC ? { titleBar: 'hidden', cornerRadius: 26 } : {},

  /** Space that keeps the first row of content clear of the traffic lights. */
  top: MAC ? 44 : 0,

  /**
   * A card for grouped content: a faint neutral tint with a hairline edge, so it reads as a lighter
   * area on either theme and over either backdrop. 16 on macOS and 8 on Windows, the Fluent radius for containers.
   */
  panel: (view, radius = 16) =>
    Card(view).background('#14808080').border('#26808080', 1).cornerRadius(radius * system.softCornerRadiusMultiplier),
};

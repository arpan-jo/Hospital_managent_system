/**
 * The bottom tab bar floats above the content rather than reserving space, so
 * anything scrolling underneath it has to pad past it by hand.
 *
 * Add this to `insets.bottom` for the bottom padding of a scroll view — or for a
 * pinned footer — on any screen that lives inside the tabs. It covers the bar's
 * height, its gap from the screen edge, and a little breathing room.
 */
export const TAB_BAR_CLEARANCE = 100;

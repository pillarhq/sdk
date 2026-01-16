/**
 * Positioning utilities for tooltips and floating elements
 */

export type Position = 'top' | 'bottom' | 'left' | 'right' | 'auto';
export type Alignment = 'start' | 'center' | 'end';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionResult {
  x: number;
  y: number;
  position: Position;
  arrowX?: number;
  arrowY?: number;
}

interface PositionOptions {
  position: Position;
  alignment?: Alignment;
  offset?: number;
  padding?: number;
  arrowSize?: number;
}

/**
 * Gets the bounding rect of an element
 */
export function getElementRect(element: Element): Rect {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Gets the viewport rect
 */
export function getViewportRect(): Rect {
  return {
    x: window.scrollX,
    y: window.scrollY,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * Calculates available space in each direction from an element
 */
export function getAvailableSpace(
  anchor: Rect,
  viewport: Rect,
  padding: number = 8
): Record<Position, number> {
  return {
    top: anchor.y - viewport.y - padding,
    bottom: viewport.y + viewport.height - (anchor.y + anchor.height) - padding,
    left: anchor.x - viewport.x - padding,
    right: viewport.x + viewport.width - (anchor.x + anchor.width) - padding,
    auto: 0, // Not used for space calculation
  };
}

/**
 * Determines the best position for a floating element
 */
export function getBestPosition(
  anchor: Rect,
  floating: { width: number; height: number },
  options: PositionOptions
): Position {
  if (options.position !== 'auto') {
    return options.position;
  }

  const viewport = getViewportRect();
  const space = getAvailableSpace(anchor, viewport, options.padding);
  const offset = options.offset || 8;

  // Check if each position has enough space
  const fits = {
    top: space.top >= floating.height + offset,
    bottom: space.bottom >= floating.height + offset,
    left: space.left >= floating.width + offset,
    right: space.right >= floating.width + offset,
  };

  // Priority: bottom, top, right, left
  if (fits.bottom) return 'bottom';
  if (fits.top) return 'top';
  if (fits.right) return 'right';
  if (fits.left) return 'left';

  // If nothing fits, use the position with most space
  const sorted = Object.entries(space)
    .filter(([key]) => key !== 'auto')
    .sort(([, a], [, b]) => b - a);

  return sorted[0][0] as Position;
}

/**
 * Calculates the position of a floating element relative to an anchor
 */
export function calculatePosition(
  anchor: Rect,
  floating: { width: number; height: number },
  options: PositionOptions
): PositionResult {
  const {
    alignment = 'center',
    offset = 8,
    padding = 8,
    arrowSize = 8,
  } = options;

  const viewport = getViewportRect();
  const position = getBestPosition(anchor, floating, options);
  
  let x = 0;
  let y = 0;
  let arrowX: number | undefined;
  let arrowY: number | undefined;

  // Calculate base position
  switch (position) {
    case 'top':
      y = anchor.y - floating.height - offset;
      x = getAlignedX(anchor, floating, alignment);
      arrowX = anchor.x + anchor.width / 2 - arrowSize / 2;
      break;

    case 'bottom':
      y = anchor.y + anchor.height + offset;
      x = getAlignedX(anchor, floating, alignment);
      arrowX = anchor.x + anchor.width / 2 - arrowSize / 2;
      break;

    case 'left':
      x = anchor.x - floating.width - offset;
      y = getAlignedY(anchor, floating, alignment);
      arrowY = anchor.y + anchor.height / 2 - arrowSize / 2;
      break;

    case 'right':
      x = anchor.x + anchor.width + offset;
      y = getAlignedY(anchor, floating, alignment);
      arrowY = anchor.y + anchor.height / 2 - arrowSize / 2;
      break;
  }

  // Constrain to viewport
  x = Math.max(
    viewport.x + padding,
    Math.min(x, viewport.x + viewport.width - floating.width - padding)
  );
  y = Math.max(
    viewport.y + padding,
    Math.min(y, viewport.y + viewport.height - floating.height - padding)
  );

  // Adjust arrow position relative to constrained floating element
  if (arrowX !== undefined) {
    arrowX = Math.max(
      x + arrowSize,
      Math.min(arrowX, x + floating.width - arrowSize * 2)
    );
    arrowX -= x; // Make relative to floating element
  }
  if (arrowY !== undefined) {
    arrowY = Math.max(
      y + arrowSize,
      Math.min(arrowY, y + floating.height - arrowSize * 2)
    );
    arrowY -= y; // Make relative to floating element
  }

  return { x, y, position, arrowX, arrowY };
}

function getAlignedX(
  anchor: Rect,
  floating: { width: number },
  alignment: Alignment
): number {
  switch (alignment) {
    case 'start':
      return anchor.x;
    case 'end':
      return anchor.x + anchor.width - floating.width;
    case 'center':
    default:
      return anchor.x + anchor.width / 2 - floating.width / 2;
  }
}

function getAlignedY(
  anchor: Rect,
  floating: { height: number },
  alignment: Alignment
): number {
  switch (alignment) {
    case 'start':
      return anchor.y;
    case 'end':
      return anchor.y + anchor.height - floating.height;
    case 'center':
    default:
      return anchor.y + anchor.height / 2 - floating.height / 2;
  }
}


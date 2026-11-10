export type PageMotion = 'push' | 'pop' | 'fade';

export interface PageMotionValues {
  enterX: number;
  enterOpacity: number;
  enterScale: number;
}

/**
 * How a screen enters. Matches the iOS navigation direction without keeping
 * the outgoing screen mounted: push comes from the trailing edge, pop returns
 * from the leading edge, tab switches only cross-fade.
 */
export function pageMotionValues(motion: PageMotion, width: number): PageMotionValues {
  const shift = Math.min(36, width * 0.1);
  switch (motion) {
    case 'push':
      return { enterX: shift, enterOpacity: 0.84, enterScale: 0.995 };
    case 'pop':
      return { enterX: -shift * 0.66, enterOpacity: 0.9, enterScale: 0.998 };
    default:
      return { enterX: 0, enterOpacity: 0, enterScale: 1 };
  }
}

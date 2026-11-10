import { pageMotionValues } from '../page-motion';

describe('page transitions', () => {
  test('push enters from the trailing edge', () => {
    expect(pageMotionValues('push', 390).enterX).toBeGreaterThan(0);
  });

  test('pop enters from the leading edge', () => {
    expect(pageMotionValues('pop', 390).enterX).toBeLessThan(0);
  });

  test('tab switches only cross-fade', () => {
    const fade = pageMotionValues('fade', 390);
    expect(fade.enterX).toBe(0);
    expect(fade.enterOpacity).toBe(0);
    expect(fade.enterScale).toBe(1);
  });

  test('the slide stays subtle on wide screens', () => {
    expect(pageMotionValues('push', 1440).enterX).toBe(36);
  });
});

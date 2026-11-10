import { scaledLineHeight, textMaxScale, textVariants, type TextVariant } from '../typography';

describe('Dynamic Type line heights', () => {
  test('keeps the design value at the default text size', () => {
    expect(scaledLineHeight(24, 1, 1.6)).toBe(24);
  });

  test('scales with the user text size', () => {
    expect(scaledLineHeight(24, 1.5, 1.6)).toBe(36);
  });

  test('stops at the role cap so dense rows keep their layout', () => {
    expect(scaledLineHeight(48, 3, 1.2)).toBe(57.6);
  });

  test('leaves text without an explicit line height alone', () => {
    expect(scaledLineHeight(undefined, 2, 1.6)).toBeUndefined();
  });

  test('every text role allows at least the default size', () => {
    for (const variant of Object.keys(textVariants) as TextVariant[]) {
      expect(textMaxScale[variant]).toBeGreaterThanOrEqual(1);
    }
  });
});

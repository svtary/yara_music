import { describe, expect, it } from 'vitest';

import { yaraTokens } from './tokens';

describe('Yara visual foundation tokens', () => {
  it('preserves the approved Figma color and shape anchors', () => {
    expect(yaraTokens.color.accent).toBe('#ff4f17');
    expect(yaraTokens.color.surfaceWarm).toBe('#f5ede3');
    expect(yaraTokens.color.text).toBe('#1f1c17');
    expect(yaraTokens.color.textSecondary).toBe('#756e63');
    expect(yaraTokens.radius.feature).toBe(20);
    expect(yaraTokens.radius.pill).toBe(999);
  });
});

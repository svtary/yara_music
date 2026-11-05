import type { ThemeConfig } from 'antd';

import { yaraTokens } from './tokens';

export const yaraAntdTheme: ThemeConfig = {
  cssVar: { key: 'yara' },
  hashed: true,
  token: {
    colorPrimary: yaraTokens.color.accent,
    colorInfo: yaraTokens.color.accent,
    colorText: yaraTokens.color.text,
    colorTextSecondary: yaraTokens.color.textSecondary,
    colorBgBase: yaraTokens.color.background,
    colorBgContainer: yaraTokens.color.background,
    colorBgLayout: yaraTokens.color.background,
    colorBorder: yaraTokens.color.border,
    colorBorderSecondary: yaraTokens.color.border,
    fontFamily: yaraTokens.typography.family,
    fontSize: 14,
    lineHeight: yaraTokens.typography.lineHeight,
    borderRadius: yaraTokens.radius.card,
    borderRadiusLG: yaraTokens.radius.feature,
    controlHeight: 40,
    boxShadow: 'none',
    boxShadowSecondary: 'none',
  },
  components: {
    Button: {
      borderRadius: yaraTokens.radius.pill,
      fontWeight: yaraTokens.typography.weight.semibold,
      primaryShadow: 'none',
    },
    Card: {
      borderRadiusLG: yaraTokens.radius.feature,
      paddingLG: yaraTokens.space[6],
    },
    Layout: {
      bodyBg: yaraTokens.color.background,
      footerBg: yaraTokens.color.background,
      headerBg: yaraTokens.color.background,
    },
    Tag: {
      borderRadiusSM: yaraTokens.radius.pill,
      defaultBg: yaraTokens.color.surfaceWarm,
      defaultColor: yaraTokens.color.text,
    },
  },
};

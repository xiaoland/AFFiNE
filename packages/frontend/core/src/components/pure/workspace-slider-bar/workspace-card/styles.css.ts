import { cssVar } from '@toeverything/theme';
import { globalStyle, style } from '@vanilla-extract/css';

export const container = style({
  height: '50px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 6px',
  borderRadius: 4,
  outline: 'none',
  width: 'fit-content',
  maxWidth: '100%',
  color: cssVar('textPrimaryColor'),
  ':hover': {
    cursor: 'pointer',
    background: cssVar('hoverColor'),
  },
});

export const workspaceInfoSlider = style({
  height: 42,
  overflow: 'hidden',
});
export const workspaceInfoSlide = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  transform: 'translateY(0)',
  transition: 'transform 0.2s',
  selectors: {
    [`.${workspaceInfoSlider}[data-active="true"] &`]: {
      transform: 'translateY(-42px)',
    },
  },
});
export const workspaceInfo = style({
  flexGrow: 1,
  overflow: 'hidden',
  height: 42,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
});

export const workspaceName = style({
  fontSize: cssVar('fontSm'),
  lineHeight: '22px',
  fontWeight: 500,
  userSelect: 'none',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const workspaceStatus = style({
  display: 'flex',
  gap: 2,
  alignItems: 'center',
  fontSize: cssVar('fontXs'),
  lineHeight: '20px',
  fontWeight: 400,
  color: cssVar('black50'),
});
globalStyle(`.${workspaceStatus} svg`, {
  width: 16,
  height: 16,
  color: cssVar('iconSecondary'),
});

export const workspaceActiveStatus = style({
  display: 'flex',
  gap: 2,
  alignItems: 'center',
  fontSize: cssVar('fontSm'),
  lineHeight: '22px',
  color: cssVar('textSecondaryColor'),
});
globalStyle(`.${workspaceActiveStatus} svg`, {
  width: 16,
  height: 16,
});

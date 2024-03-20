import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';
export const scrollContainer = style({
  flex: 1,
  width: '100%',
  paddingBottom: '32px',
});
export const headerCreateNewButton = style({
  transition: 'opacity 0.1s ease-in-out',
});
export const headerDisplayButton = style({
  marginLeft: '16px',
  ['WebkitAppRegion' as string]: 'no-drag',
});
export const headerCreateNewCollectionIconButton = style({
  padding: '4px 8px',
  fontSize: '16px',
  width: '32px',
  height: '28px',
  borderRadius: '8px',
});
export const headerCreateNewButtonHidden = style({
  opacity: 0,
  pointerEvents: 'none',
});

export const menu = style({
  minWidth: '220px',
});

export const subMenuTrigger = style({
  paddingRight: '8px',
});

export const subMenuTriggerContent = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  fontWeight: 500,
  fontSize: cssVar('fontXs'),
});
export const subMenuItem = style({
  fontSize: cssVar('fontXs'),
  flexWrap: 'nowrap',
  selectors: {
    '&[data-active="true"]': {
      color: cssVar('primaryColor'),
    },
  },
});

export const currentGroupType = style({
  fontWeight: 400,
  color: cssVar('textSecondaryColor'),
});

export const listOption = style({
  padding: '4px 12px',
  height: '28px',
  fontSize: cssVar('fontXs'),
  fontWeight: 500,
  color: cssVar('textSecondaryColor'),
  marginBottom: '4px',
});
export const properties = style({
  padding: '4px 12px',
  height: '28px',
  fontSize: cssVar('fontXs'),
});
export const propertiesWrapper = style({
  display: 'flex',
  flexWrap: 'wrap',
  maxWidth: '200px',
  gap: '8px',
  padding: '4px 12px',
});

export const arrowDownSmallIcon = style({
  width: '16px',
  height: '16px',
  color: cssVar('iconColor'),
});

export const body = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  height: '100%',
  width: '100%',
});

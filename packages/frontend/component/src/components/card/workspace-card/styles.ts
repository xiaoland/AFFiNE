import { displayFlex, styled } from '../../../styles';

export const StyledModalHeader = styled('div')(() => {
  return {
    width: '100%',
    height: '72px',
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: '24px 24px 0 0',
    padding: '0 40px',
    ...displayFlex('space-between', 'center'),
  };
});

export const StyledWorkspaceType = styled('div')(() => {
  return {
    ...displayFlex('flex-start', 'center'),
    width: '100%',
    height: '20px',
  };
});

export const StyledWorkspaceTypeEllipse = styled('div')<{
  cloud?: boolean;
}>(({ cloud }) => {
  return {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    background: cloud
      ? 'var(--affine-palette-shape-blue)'
      : 'var(--affine-palette-shape-green)',
  };
});

export const StyledWorkspaceTypeText = styled('div')(() => {
  return {
    fontSize: '12px',
    fontWeight: 500,
    lineHeight: '20px',
    marginLeft: '4px',
    color: 'var(--affine-text-secondary-color)',
  };
});

export const StyledIconContainer = styled('div')(() => {
  return {
    ...displayFlex('flex-start', 'center'),
    fontSize: '14px',
    gap: '8px',
    color: 'var(--affine-icon-secondary)',
  };
});

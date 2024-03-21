import { TagService } from '@affine/core/modules/tag';
import { useAFFiNEI18N } from '@affine/i18n/hooks';
import { FavoritedIcon, FavoriteIcon } from '@blocksuite/icons';
import type { DocMeta } from '@blocksuite/store';
import { useService } from '@toeverything/infra/di';
import { useLiveData } from '@toeverything/infra/livedata';
import { atom, useAtomValue } from 'jotai';
import { type ReactNode, useMemo } from 'react';

import * as styles from './group-definitions.css';
import type { ItemGroupDefinition, ListItem, PageGroupByType } from './types';
import { type DateKey } from './types';
import { betweenDaysAgo, withinDaysAgo } from './utils';

export const pageGroupByTypeAtom = atom<PageGroupByType>('updatedDate');

const GroupLabel = ({
  label,
  count,
  icon,
}: {
  label: string | ReactNode;
  count: number;
  icon?: ReactNode;
}) => (
  <div className={styles.groupLabelWrapper}>
    {icon}
    <div className={styles.groupLabel}>{label}</div>
    <div className={styles.pageCount}>{` · ${count}`}</div>
  </div>
);

// todo: optimize date matchers
export const useDateGroupDefinitions = <T extends ListItem>(
  key: DateKey
): ItemGroupDefinition<T>[] => {
  const t = useAFFiNEI18N();
  return useMemo(
    () => [
      {
        id: 'today',
        label: count => (
          <GroupLabel label={t['com.affine.today']()} count={count} />
        ),
        match: item =>
          withinDaysAgo(new Date(item[key] ?? item.createDate ?? ''), 1),
      },
      {
        id: 'yesterday',
        label: count => (
          <GroupLabel label={t['com.affine.yesterday']()} count={count} />
        ),
        match: item =>
          betweenDaysAgo(new Date(item[key] ?? item.createDate ?? ''), 1, 2),
      },
      {
        id: 'last7Days',
        label: count => (
          <GroupLabel label={t['com.affine.last7Days']()} count={count} />
        ),
        match: item =>
          betweenDaysAgo(new Date(item[key] ?? item.createDate ?? ''), 2, 7),
      },
      {
        id: 'last30Days',
        label: count => (
          <GroupLabel label={t['com.affine.last30Days']()} count={count} />
        ),
        match: item =>
          betweenDaysAgo(new Date(item[key] ?? item.createDate ?? ''), 7, 30),
      },
      {
        id: 'moreThan30Days',
        label: count => (
          <GroupLabel label={t['com.affine.moreThan30Days']()} count={count} />
        ),
        match: item =>
          !withinDaysAgo(new Date(item[key] ?? item.createDate ?? ''), 30),
      },
    ],
    [key, t]
  );
};
export const useTagGroupDefinitions = (): ItemGroupDefinition<ListItem>[] => {
  const tagService = useService(TagService);
  const tagMetas = useLiveData(tagService.tagMetas);
  return useMemo(() => {
    return tagMetas.map(tag => ({
      id: tag.id,
      label: count => (
        <GroupLabel
          label={tag.title}
          count={count}
          icon={
            <div
              className={styles.tagIcon}
              style={{
                backgroundColor: tag.color,
              }}
            ></div>
          }
        />
      ),
      match: item => (item as DocMeta).tags?.includes(tag.id),
    }));
  }, [tagMetas]);
};

export const useFavoriteGroupDefinitions = <
  T extends ListItem,
>(): ItemGroupDefinition<T>[] => {
  const t = useAFFiNEI18N();
  return useMemo(
    () => [
      {
        id: 'favourited',
        label: count => (
          <GroupLabel
            label={t['com.affine.page.group-header.favourited']()}
            count={count}
            icon={<FavoritedIcon className={styles.favouritedIcon} />}
          />
        ),
        match: item => !!(item as DocMeta).favorite,
      },
      {
        id: 'notFavourited',
        label: count => (
          <GroupLabel
            label={t['com.affine.page.group-header.not-favourited']()}
            count={count}
            icon={<FavoriteIcon className={styles.notFavouritedIcon} />}
          />
        ),
        match: item => !(item as DocMeta).favorite,
      },
    ],
    [t]
  );
};

export const usePageItemGroupDefinitions = () => {
  const key = useAtomValue(pageGroupByTypeAtom);
  const tagGroupDefinitions = useTagGroupDefinitions();
  const createDateGroupDefinitions = useDateGroupDefinitions('createDate');
  const updatedDateGroupDefinitions = useDateGroupDefinitions('updatedDate');
  const favouriteGroupDefinitions = useFavoriteGroupDefinitions();

  return useMemo(() => {
    const itemGroupDefinitions = {
      createDate: createDateGroupDefinitions,
      updatedDate: updatedDateGroupDefinitions,
      tag: tagGroupDefinitions,
      favourites: favouriteGroupDefinitions,
      none: undefined,

      // add more here later
      // todo: some page group definitions maybe dynamic
    };
    return itemGroupDefinitions[key];
  }, [
    createDateGroupDefinitions,
    favouriteGroupDefinitions,
    key,
    tagGroupDefinitions,
    updatedDateGroupDefinitions,
  ]);
};

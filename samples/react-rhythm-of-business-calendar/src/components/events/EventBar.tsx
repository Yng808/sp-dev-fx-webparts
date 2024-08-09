import React, { CSSProperties, FC, useMemo } from 'react';
import { css, Stack, StackItem, useTheme } from '@fluentui/react';
import { useConst } from '@fluentui/react-hooks';
import { LockIcon, POIIcon, RecentIcon, RepeatAllIcon } from '@fluentui/react-icons-mdl2';
import { IEvent } from 'model';
import { useConfigurationService } from 'services';

import { Humanize as strings } from 'ComponentStrings';

import styles from './EventBar.module.scss';

// Utility function to determine if a color is dark
const isDarkColor = (color: string): boolean => {
    const rgb = parseInt(color.slice(1), 16); 
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >>  8) & 0xff;
    const b = (rgb >>  0) & 0xff;

    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

    return luminance < 128;
};

export enum EventBarSize {
    Compact,
    Large
}

interface IProps {
    event: IEvent;
    startsIn: boolean;
    endsIn: boolean;
    timeStringOverride?: string;
    size?: EventBarSize;
}

export const EventBar: FC<IProps> = ({ event, startsIn, endsIn, timeStringOverride, size = EventBarSize.Compact }) => {
    const { palette: { themePrimary } } = useTheme();
    const { active: { useApprovals } } = useConfigurationService();

    const { isPendingApproval, isRejected, title, start, end, isAllDay, location, tag, color, isConfidential, isRecurring } = event;

    const eventClassName = css(
        styles.event,
        {
            [styles.unapproved]: useApprovals && isPendingApproval,
            [styles.rejected]: isRejected,
            [styles.startsIn]: startsIn,
            [styles.endsIn]: endsIn,
            [styles.compact]: size === EventBarSize.Compact
        }
    );

    const style: CSSProperties = useMemo(() => {
        return {
            backgroundColor: color?.toCssString() || themePrimary
        };
    }, [color, themePrimary]);

    const startTimeString = timeStringOverride ||
        (size === EventBarSize.Compact
            ? (!isAllDay && start?.format('LT'))
            : isAllDay ? strings.AllDay : `${start?.format('LT')} - ${end?.format('LT')}`
        );

    return (
        <Stack className={eventClassName} style={style} tokens={useConst({ childrenGap: 2 })}>
            <Stack horizontal verticalAlign="center" title={title} tokens={useConst({ childrenGap: 6 })}>
                {tag && <span>[{tag}]</span>}
                <StackItem className={styles.text}>
                    {size === EventBarSize.Compact && startTimeString && `${startTimeString}, `}
                    {title}
                </StackItem>
                {isConfidential && <LockIcon />}
                <StackItem grow className={styles.recur}>
                    {isRecurring && <RepeatAllIcon />}
                </StackItem>
            </Stack>
            {size === EventBarSize.Large && <>
                <Stack horizontal verticalAlign='center' tokens={useConst({ childrenGap: 4 })}>
                    <RecentIcon />
                    <span className={styles.text}>{startTimeString}</span>
                </Stack>
                <Stack horizontal verticalAlign='center' tokens={useConst({ childrenGap: 4 })}>
                    <POIIcon />
                    <span className={styles.text}>{location || '-'}</span>
                </Stack>
            </>}
        </Stack>
    );
}
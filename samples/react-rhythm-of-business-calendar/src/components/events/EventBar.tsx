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
    let r, g, b;

    // Check if the color is in rgba format
    if (color.startsWith('rgba') || color.startsWith('rgb')) {
        // Extract the RGB values
        const rgbValues = color.match(/\d+/g)?.map(Number) ?? [];
        [r, g, b] = rgbValues;
    } else {
        // Assume it's a hex color and process accordingly
        color = color.replace(/^#/, '');

        // Convert short form hex to full form
        if (color.length === 3) {
            color = color.split('').map(c => c + c).join('');
        }

        r = parseInt(color.substring(0, 2), 16);
        g = parseInt(color.substring(2, 4), 16);
        b = parseInt(color.substring(4, 6), 16);
    }

    // Normalize the RGB values to a 0-1 scale
    r /= 255;
    g /= 255;
    b /= 255;

    // Calculate relative luminance
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // Return true if the luminance is below 0.5 (considered dark)
    return luminance < 0.5;
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
        console.log('color is:', color);
        const bgColor = color?.toCssString() || themePrimary;
        const textColor = isDarkColor(bgColor) ? 'white' : 'black';

        console.log('background color:', bgColor, 'text color:' ,textColor);

        return {
            backgroundColor: bgColor,
            color: textColor // Set the text color dynamically
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
                <StackItem className={styles.text} style={{ color: style.color }}>
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
                    <RecentIcon style={{ color: style.color }} />
                    <span className={styles.text} style={{ color: style.color }}>{startTimeString}</span>
                </Stack>
                <Stack horizontal verticalAlign='center' tokens={useConst({ childrenGap: 4 })}>
                    <POIIcon style={{ color: style.color }} />
                    <span className={styles.text} style={{ color: style.color }}>{location || '-'}</span>
                </Stack>
            </>}
        </Stack>
    );
}
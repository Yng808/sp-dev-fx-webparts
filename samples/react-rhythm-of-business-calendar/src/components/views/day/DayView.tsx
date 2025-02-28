import React, { FC, useEffect, useRef, useCallback } from 'react';
import { FocusZone, IStackItemStyles, Separator, Stack, StackItem, Text } from '@fluentui/react';
import { EventOccurrence, ViewKeys } from 'model';
import { useEventCommandActionButtons, useWindowSize } from '../../hooks';
import { EventOverview, IEventCommands, EventDetailsCallout, IEventDetailsCallout } from '../../events';
import { IViewDescriptor } from '../IViewDescriptor';
import { IViewProps } from '../IViewProps';
import { Builder } from '../month/Builder'; // Import Builder

import * as strings from 'ComponentStrings';

import styles from './DayView.module.scss';

const CommandOrientationBreakpoint = 1024;

const eventOverviewStackItemStyles: IStackItemStyles = {
    root: { minWidth: 0 }
};

const eventCommandsStackItemStyles: IStackItemStyles = {
    root: { minWidth: 160 }
};

interface IEventCardProps {
    occurrence: EventOccurrence;
    commands: IEventCommands,
}

const EventCard: FC<IEventCardProps> = ({ occurrence, commands }) => {
    const [
        viewCommand,
        addToOutlookCommand,
        getLinkCommand
    ] = useEventCommandActionButtons(commands, occurrence);

    const { width } = useWindowSize();
    const layoutCommandsHorizontally = width <= CommandOrientationBreakpoint;

    return (
        <Stack horizontal={!layoutCommandsHorizontally} data-is-focusable className={styles.event}>
            <StackItem grow styles={eventOverviewStackItemStyles}>
                <EventOverview event={occurrence} />
            </StackItem>
            <Separator vertical={!layoutCommandsHorizontally} />
            <StackItem styles={eventCommandsStackItemStyles}>
                <Stack horizontal={layoutCommandsHorizontally} wrap>
                    {viewCommand}
                    {addToOutlookCommand}
                    {getLinkCommand}
                </Stack>
            </StackItem>
        </Stack>
    );
};

const DayView: FC<IViewProps> = ({
    cccurrences,
    eventCommands,
    anchorDate, // Ensure anchorDate is included
}) => {
    const detailsCallout = useRef<IEventDetailsCallout>();

    useEffect(() => {
        console.log('Occurrences:', cccurrences);
    }, [cccurrences]);

    const onActivate = useCallback((occurrence: EventOccurrence, target: HTMLElement) => {
        detailsCallout.current?.open(occurrence, target);
    }, []);

    const dayStart = anchorDate.clone().startOf('day');
    const dayEnd = anchorDate.clone().endOf('day');

    // Filter occurrences to include only those within the current day
    const dayOccurrences = cccurrences.filter(occurrence => 
        occurrence.start.isBetween(dayStart, dayEnd, undefined, '[]')
    );

    if (dayOccurrences.length === 0) {
        return <Text variant='large'>{strings.DayView.NoEventsMessage}</Text>;
    } else {
        const sortedEventOccurrences = dayOccurrences.sort(EventOccurrence.StartAscComparer);

        return (
            <FocusZone>
                {sortedEventOccurrences.map(occurrence =>
                    <div
                        key={`${occurrence.event.id}-${occurrence.start.format('L')}`}
                        onClick={(e) => onActivate(occurrence, e.currentTarget)}
                    >
                        <EventCard
                            occurrence={occurrence}
                            commands={eventCommands}
                        />
                    </div>
                )}
                <EventDetailsCallout
                    commands={eventCommands}
                    componentRef={detailsCallout}
                />
            </FocusZone>
        );
    }
};

export const DayViewDescriptor: IViewDescriptor = {
    id: ViewKeys.daily,
    title: strings.ViewNames.Day,
    renderer: DayView,
    dateRotatorController: {
        previousIconProps: { iconName: 'ChevronLeft' },
        nextIconProps: { iconName: 'ChevronRight' },
        previousDate: date => date.clone().subtract(1, 'day'),
        nextDate: date => date.clone().add(1, 'day'),
        dateString: date => date.format('dddd, MMMM DD, YYYY')
    },
    dateRange: Builder.dateRange // Use Builder for date range
};

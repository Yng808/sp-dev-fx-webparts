import React, { FC, useEffect, useState } from 'react';
import { FocusZone, IStackItemStyles, Separator, Stack, StackItem, Text } from '@fluentui/react';
import { EventOccurrence, ViewKeys } from 'model';
import { useEventCommandActionButtons, useWindowSize } from '../../hooks';
import { EventOverview, IEventCommands } from '../../events';
import { IViewDescriptor } from '../IViewDescriptor';
import { IViewProps } from '../IViewProps';
import { Builder } from './Builder';
import { fetchParkingStalls } from '../list/spEventDetailsList';
import * as strings from 'ComponentStrings';
import { sp } from "@pnp/sp";
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
    commands: IEventCommands;
    parkingMap: { [id: number]: string };
}

const EventCard: FC<IEventCardProps> = ({ occurrence, commands, parkingMap }) => {
    const [
        viewCommand,
        addToOutlookCommand
    ] = useEventCommandActionButtons(commands, occurrence);

    const { width } = useWindowSize();
    const layoutCommandsHorizontally = width <= CommandOrientationBreakpoint;

    return (
        <Stack horizontal={!layoutCommandsHorizontally} data-is-focusable className={styles.event}>
            <StackItem grow styles={eventOverviewStackItemStyles}>
                <EventOverview event={occurrence}  parkingMap={parkingMap}/>
            </StackItem>
            <Separator vertical={!layoutCommandsHorizontally} />
            <StackItem styles={eventCommandsStackItemStyles}>
                <Stack horizontal={layoutCommandsHorizontally} wrap>
                    {viewCommand}
                    {addToOutlookCommand}
                </Stack>
            </StackItem>
        </Stack>
    );
};

const DayView: FC<IViewProps> = ({
    anchorDate,
    cccurrences,
    eventCommands
}) => {
    const [parkingMap, setParkingMap] = useState<{ [id: number]: string }>({});

    useEffect(() => {
        const fetchMap = async () => {
            try {
                const web = await sp.web.get();
                const siteUrl = web.Url;
                const stalls = await fetchParkingStalls(siteUrl);
                const map: { [id: number]: string } = {};
                stalls.forEach(stall => {
                    map[stall.id] = stall.parking;
                });
                setParkingMap(map);
            } catch (error) {
                console.error("Failed to load parking map:", error);
            }
        };

        fetchMap();
    }, []);

    const dayInfo = Builder.build(cccurrences, anchorDate);

    if (dayInfo.occurrences.length === 0) {
        return <Text variant="large">{strings.DayView.NoEventsMessage}</Text>;
    }

    return (
        <FocusZone>
            {dayInfo.occurrences.map((occurrence) => (
                <EventCard
                    key={`${occurrence.event.id}-${occurrence.start.format('L')}`}
                    occurrence={occurrence}
                    commands={eventCommands}
                    parkingMap={parkingMap}
                />
            ))}
        </FocusZone>
    );
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
    dateRange: (date) => {
        return {
            start: date.clone().startOf('day'),
            end: date.clone().endOf('day')
        };
    }
};

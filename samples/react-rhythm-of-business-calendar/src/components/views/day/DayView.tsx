import React, { FC, useEffect, useState } from 'react';
import { Checkbox, FocusZone, IStackItemStyles, Separator, Stack, StackItem, Text } from '@fluentui/react';
import { sp } from '@pnp/sp';
import { EventOccurrence, ViewKeys } from 'model';
import { useEventCommandActionButtons, useWindowSize } from '../../hooks';
import { EventOverview, IEventCommands } from '../../events';
import { fetchParkingStalls, ParkingSpot } from '../list/spEventDetailsList';
import { IViewDescriptor } from '../IViewDescriptor';
import { IViewProps } from '../IViewProps';
import { Builder } from './Builder';
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
    commands: IEventCommands;
}

const EventCard: FC<IEventCardProps> = ({ occurrence, commands }) => {
    const [
        viewCommand,
        // addToOutlookCommand
    ] = useEventCommandActionButtons(commands, occurrence);

    const { width } = useWindowSize();
    const layoutCommandsHorizontally = width <= CommandOrientationBreakpoint;

    return (
        <Stack horizontal={!layoutCommandsHorizontally} data-is-focusable className={styles.event}>
            <StackItem grow styles={eventOverviewStackItemStyles}>
                <EventOverview event={occurrence}/>
            </StackItem>
            <Separator vertical={!layoutCommandsHorizontally} />
            <StackItem styles={eventCommandsStackItemStyles}>
                <Stack horizontal={layoutCommandsHorizontally} wrap>
                    {viewCommand}
                    {/* {addToOutlookCommand} */}
                </Stack>
            </StackItem>
        </Stack>
    );
};

const EmptyStallCard: FC<{ stall: ParkingSpot }> = ({ stall }) => (
    <Stack data-is-focusable className={`${styles.event} ${styles.emptyStall}`}>
        <Text block variant="large" styles={{ root: { fontWeight: 600, paddingBottom: 2 } }}>
            {stall.parking}
        </Text>
    </Stack>
);

type DayViewItem =
    | { kind: 'event'; occurrence: EventOccurrence }
    | { kind: 'empty'; stall: ParkingSpot };

const DayView: FC<IViewProps> = ({
    anchorDate,
    cccurrences,
    eventCommands
}) => {
    const [showEmptyStalls, setShowEmptyStalls] = useState(false);
    const [parkingStalls, setParkingStalls] = useState<ParkingSpot[]>([]);
    const [parkingStallsLoaded, setParkingStallsLoaded] = useState(false);
    const [parkingStallsError, setParkingStallsError] = useState('');
    const dayInfo = Builder.build(cccurrences, anchorDate);

    useEffect(() => {
        if (!showEmptyStalls || parkingStallsLoaded) return;

        let active = true;
        setParkingStallsError('');

        const loadParkingStalls = async () => {
            try {
                const siteUrl = (await sp.web.get()).Url;
                const stalls = await fetchParkingStalls(siteUrl);
                if (active) {
                    setParkingStalls(stalls);
                    setParkingStallsLoaded(true);
                }
            } catch (error) {
                if (active) {
                    console.error('Failed to load parking stalls for the day view:', error);
                    setParkingStallsError('Unable to load empty parking stalls.');
                }
            }
        };

        void loadParkingStalls();
        return () => { active = false; };
    }, [showEmptyStalls, parkingStallsLoaded]);

    const occupiedStallIds = new Set(dayInfo.occurrences.map(occurrence => occurrence.parkingStalls));
    const items: DayViewItem[] = dayInfo.occurrences.map(occurrence => ({
        kind: 'event',
        occurrence
    }));

    if (showEmptyStalls && parkingStallsLoaded) {
        parkingStalls
            .filter(stall => !occupiedStallIds.has(stall.id))
            .forEach(stall => items.push({ kind: 'empty', stall }));
    }

    items.sort((a, b) => {
        const aStallId = a.kind === 'event' ? a.occurrence.parkingStalls : a.stall.id;
        const bStallId = b.kind === 'event' ? b.occurrence.parkingStalls : b.stall.id;
        if (aStallId !== bStallId) return aStallId - bStallId;

        if (a.kind === 'event' && b.kind === 'event') {
            return a.occurrence.start.diff(b.occurrence.start);
        }

        return 0;
    });

    const loadingEmptyStalls = showEmptyStalls && !parkingStallsLoaded && !parkingStallsError;

    return (
        <>
            <Checkbox
                className={styles.emptyStallToggle}
                label="Show Unassigned Parking"
                checked={showEmptyStalls}
                onChange={(_, checked) => setShowEmptyStalls(Boolean(checked))}
            />
            {loadingEmptyStalls && <Text block styles={{ root: { margin: 10 } }}>Loading parking stalls...</Text>}
            {parkingStallsError && <Text className={styles.loadError}>{parkingStallsError}</Text>}
            {items.length === 0 && !loadingEmptyStalls ? (
                <Text variant="large">{strings.DayView.NoEventsMessage}</Text>
            ) : items.length > 0 ? (
                <FocusZone>
                    {items.map(item => item.kind === 'event' ? (
                        <EventCard
                            key={`event-${item.occurrence.event.id}-${item.occurrence.start.toISOString()}`}
                            occurrence={item.occurrence}
                            commands={eventCommands}
                        />
                    ) : (
                        <EmptyStallCard key={`empty-stall-${item.stall.id}`} stall={item.stall} />
                    ))}
                </FocusZone>
            ) : null}
        </>
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

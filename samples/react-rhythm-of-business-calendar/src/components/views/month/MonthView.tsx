import React, { FC, useCallback, useEffect, useRef } from 'react';
import { EventOccurrence, ViewKeys } from 'model';
import { EventDetailsCallout, IEventDetailsCallout } from '../../events';
import { IViewDescriptor } from '../IViewDescriptor';
import { IViewProps } from '../IViewProps';
import { Builder } from './Builder';
import { Header } from './Header';
import { Week } from './Week';

import { ViewNames as strings } from 'ComponentStrings';
import { FocusZone } from '@fluentui/react';
import Legend from './Legend';

const MonthView: FC<IViewProps> = ({ anchorDate, eventCommands, viewCommands, cccurrences }) => {
    const weeks = Builder.build(cccurrences, anchorDate);
    const detailsCallout = useRef<IEventDetailsCallout>();

   

    // Log refiner values for each event occurrence
    useEffect(() => {
        console.log('occurrences:',cccurrences);
        cccurrences.forEach(cccurrence => {
            const event = cccurrence.event;
            const valuesByRefiner = event.valuesByRefiner();

            //console.log(`Event ID: ${event.id}, Title: ${event.title}`);
            valuesByRefiner.forEach((values, refiner) => {
                //console.log(`Refiner ID: ${refiner.id}, Order: ${refiner.order}, Required: ${refiner.required}`);
                values.forEach(value => {
                   // console.log(` - Value: ${value.title}, Tag: ${value.tag}, Color: ${value.color.toHexString()}, Active: ${value.isActive}`);
                });
            });
        });
    }, [cccurrences]);


    const onActivate = useCallback((cccurrence: EventOccurrence, target: HTMLElement) => {
        detailsCallout.current?.open(cccurrence, target);
    }, []);

    return (
        <FocusZone>
            <Header />
            {weeks.map(week =>
                <Week
                    key={week.start.format('L')}
                    week={week}
                    anchorDate={anchorDate}
                    onActivate={onActivate}
                    viewCommands={viewCommands}
                />
            )}
            <EventDetailsCallout
                commands={eventCommands}
                componentRef={detailsCallout}
            />
            <Legend/>
        </FocusZone>
    );
};

export const MonthViewDescriptor: IViewDescriptor = {
    id: ViewKeys.monthly,
    title: strings.Month,
    renderer: MonthView,
    dateRotatorController: {
        previousIconProps: { iconName: 'ChevronUp' },
        nextIconProps: { iconName: 'ChevronDown' },
        previousDate: date => date.clone().subtract(1, 'month'),
        nextDate: date => date.clone().add(1, 'month'),
        dateString: date => date.format('MMMM YYYY')
    },
    dateRange: Builder.dateRange
};
import React from 'react';
import { IViewDescriptor } from '../IViewDescriptor';
import EventDetailsList from './EventDetailsList';
import { ViewKeys } from 'model';
import { Builder } from './Builder';

export const ListViewDescriptor: IViewDescriptor = {
    id: ViewKeys.list,
    title: 'List of Events',
    renderer: (props) => <EventDetailsList {...props} />,
    dateRotatorController: {
        previousIconProps: { iconName: 'ChevronLeft' },
        nextIconProps: { iconName: 'ChevronRight' },
        previousDate: (date) => date, // No actual rotation needed
        nextDate: (date) => date, // No actual rotation needed
        dateString: (date) => date.format('MMMM YYYY')
    },
    dateRange:  Builder.dateRange
};

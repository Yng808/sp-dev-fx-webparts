import React from 'react';
import { IViewDescriptor } from '../IViewDescriptor';
import RefinerPieChart from './RefinerPieChart';
import { ViewKeys } from 'model';

export const PieChartViewDescriptor: IViewDescriptor = {
    id: ViewKeys.pieChart,
    title: 'Event/Trip Breakout',
    renderer: (props) => <RefinerPieChart {...props} />,
    dateRotatorController: {
        previousIconProps: { iconName: 'ChevronLeft' },
        nextIconProps: { iconName: 'ChevronRight' },
        previousDate: (date) => date, // No actual rotation needed
        nextDate: (date) => date, // No actual rotation needed
        dateString: (date) => date.format('MMMM YYYY')
    },
    dateRange: (anchorDate, config) => null 
};

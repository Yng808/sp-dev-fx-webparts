import { arrayToMap } from "common";
import { IViewDescriptor } from "./IViewDescriptor";
import { DayViewDescriptor } from "./day/DayView";
import { WeekViewDescriptor } from "./week/WeekView";
import { MonthViewDescriptor } from "./month/MonthView";
import { QuarterViewDescriptor } from "./quarter/QuarterView";
import { PieChartViewDescriptor } from "./reports/PieChartView";
import { ListViewDescriptor } from "./list/ListView";

export const ViewDescriptors: IViewDescriptor[] = [
    DayViewDescriptor,
    WeekViewDescriptor,
    MonthViewDescriptor,
    QuarterViewDescriptor,
    PieChartViewDescriptor,
    ListViewDescriptor
];

export const ViewDescriptorsById = arrayToMap(ViewDescriptors, v => v.id);
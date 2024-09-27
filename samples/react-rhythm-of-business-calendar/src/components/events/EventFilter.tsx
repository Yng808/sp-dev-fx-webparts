import { FC, ReactElement } from "react";
import { Entity, MomentRange, User } from "common";
import { Approvers, Event, EventOccurrence, Refiner, RefinerValue } from "model";
import { useConfigurationService, useDirectoryService, useTimeZoneService } from "services";
import moment, { Moment } from "moment";

interface IProps {
    events: readonly Event[];
    dateRange: MomentRange;
    refiners: readonly Refiner[];
    selectedRefinerValues: Set<RefinerValue>;
    approvers: readonly Approvers[];
    showOnlyCurrentMonth: boolean;
    children: (cccurrences: readonly EventOccurrence[]) => ReactElement;
    anchorDate: moment.Moment;
    
}


export const EventFilter: FC<IProps> = ({ events, dateRange, refiners, selectedRefinerValues, approvers, showOnlyCurrentMonth, children, anchorDate }) => {
    const { currentUser, currentUserIsSiteAdmin } = useDirectoryService();
    const { active: { useApprovals, useRefiners } } = useConfigurationService();
    const currentUserApprovers = approvers.filter(a => a.userIsAnApprover(currentUser));

    const timeZoneService = useTimeZoneService();
    const siteTimeZone = timeZoneService.siteTimeZone;

    const monthYearString = anchorDate.format('MMMM YYYY');
    const parsedDate = moment(monthYearString, 'MMMM YYYY');
    const firstDay = parsedDate.clone().startOf('month').tz(siteTimeZone.momentId, true);
    const lastDay = parsedDate.clone().endOf('month').tz(siteTimeZone.momentId, true); 


    // Use the current date to calculate the start and end of the current month
    //const now = moment();
    const startOfMonth = firstDay;
    const endOfMonth = lastDay; 

    // Log the initial set of events
    console.log('Initial Events:', events);
    //console.log("Start of Month:", startOfMonth.format(), "End of Month:", endOfMonth.format());

    const filteredEventOccurrences = events
        .filter(event => !event.isSeriesException)
        .filter(Entity.NotDeletedFilter)
        .filter(event => {
            if (event.isApproved) {
                return true;
            } else if (event.isRejected && User.equal(event.creator, currentUser)) {
                return true;
            } else if (event.isPendingApproval) {
                if (!useApprovals)
                    return true;
                else if (currentUserIsSiteAdmin)
                    return true;
                else if (User.equal(event.creator, currentUser))
                    return true;
                else if (Approvers.appliesToAny(currentUserApprovers, event.valuesByRefiner()))
                    return true;
                else
                    return false;
            }
        })
        .flatMap(event => {
            if (showOnlyCurrentMonth) {
                //console.log("showOnlyCurrentMonth is true, processing event ID:", event.id);

                if (event.isRecurring && event.isSeriesMaster) {
                    const occurrences = event.expandOccurrences(dateRange);
                    //console.log(`Event ID: ${event.id} - Expanded Occurrences:`, occurrences);

                    return occurrences.filter(occurrence => {
                        const occurrenceStart = occurrence.start;
                        const occurrenceEnd = occurrence.end;
                        const isIncluded = (
                            occurrenceStart.isBetween(startOfMonth, endOfMonth, null, '[]') ||
                            occurrenceEnd.isBetween(startOfMonth, endOfMonth, null, '[]') ||
                            (occurrenceStart.isBefore(startOfMonth) && occurrenceEnd.isAfter(endOfMonth))
                        );

                        return isIncluded;
                    });
                }

                // Handle non-recurring events
                const eventStart = event.start;
                const eventEnd = event.end;
                const isIncluded = (
                    eventStart.isBetween(startOfMonth, endOfMonth, null, '[]') ||
                    eventEnd.isBetween(startOfMonth, endOfMonth, null, '[]') ||
                    (eventStart.isBefore(startOfMonth) && eventEnd.isAfter(endOfMonth))
                );

                if (isIncluded) {
                    //console.log(`Non-recurring Event Included: ID: ${event.id}, Start: ${eventStart.format()}, End: ${eventEnd.format()}`);
                    return [new EventOccurrence(event)];
                } else {
                    //console.log(`Non-recurring Event Excluded: ID: ${event.id}, Start: ${eventStart.format()}, End: ${eventEnd.format()}`);
                }
                return [];
            } else {
                // If not filtering by current month, return all occurrences or the event itself
                if (event.isRecurring && event.isSeriesMaster) {
                    const occurrences = event.expandOccurrences(dateRange);
                    //console.log(`Event ID: ${event.id} - Expanded Occurrences:`, occurrences);
                    return occurrences;
                }
                return [new EventOccurrence(event)];
            }
        })
        .filter(occurrence => {
            const valuesByRefiner = occurrence.event.valuesByRefiner();
            return !useRefiners || refiners.every(refiner => {
                const values = valuesByRefiner.get(refiner);
                if (values)
                    return values.some(v => selectedRefinerValues.has(v));
                else if (!refiner.required)
                    return selectedRefinerValues.has(refiner.blankValue);
                else
                    return true;
            });
        });

    //console.log("filteredEvents from EventFilter.tsx: ", filteredEventOccurrences);
    return children(filteredEventOccurrences);
};
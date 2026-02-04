import { FC, ReactElement } from "react";
import { Entity, MomentRange, User } from "common";
import { Approvers, Event, EventOccurrence, Refiner, RefinerValue } from "model";
import { useConfigurationService, useDirectoryService, useTimeZoneService } from "services";
import moment from "moment";

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

    const startOfMonth = firstDay;
    const endOfMonth = lastDay; 

    console.log('\n=== EVENT FILTER START ===');
    console.log('Initial Events:', events.length);
    events.forEach((e, i) => console.log(`  [${i}] "${e.title}"`));

    const afterApprovalFilter = events
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
        });

    console.log('\n After Approval Filter:', afterApprovalFilter.length);
    afterApprovalFilter.forEach((e, i) => console.log(`  [${i}] "${e.title}"`));

    const afterFlatMap = afterApprovalFilter
        .flatMap(event => {
            if (showOnlyCurrentMonth) {
                if (event.isRecurring && event.isSeriesMaster) {
                    const occurrences = event.expandOccurrences(dateRange);
                    return occurrences.filter(occurrence => {
                        const occurrenceStart = occurrence.start;
                        const occurrenceEnd = occurrence.end;
                        return (
                            occurrenceStart.isBetween(startOfMonth, endOfMonth, null, '[]') ||
                            occurrenceEnd.isBetween(startOfMonth, endOfMonth, null, '[]') ||
                            (occurrenceStart.isBefore(startOfMonth) && occurrenceEnd.isAfter(endOfMonth))
                        );
                    });
                }

                const eventStart = event.start;
                const eventEnd = event.end;
                const isIncluded = (
                    eventStart.isBetween(startOfMonth, endOfMonth, null, '[]') ||
                    eventEnd.isBetween(startOfMonth, endOfMonth, null, '[]') ||
                    (eventStart.isBefore(startOfMonth) && eventEnd.isAfter(endOfMonth))
                );

                if (isIncluded) {
                    return [new EventOccurrence(event)];
                }
                return [];
            } else {
                if (event.isRecurring && event.isSeriesMaster) {
                    const occurrences = event.expandOccurrences(dateRange);
                    return occurrences;
                }
                return [new EventOccurrence(event)];
            }
        });

    console.log('\n After FlatMap:', afterFlatMap.length);
    afterFlatMap.forEach((o, i) => console.log(`  [${i}] "${o.event.title}"`));

    const filteredEventOccurrences = afterFlatMap
        .filter(occurrence => {
            const valuesByRefiner = occurrence.event.valuesByRefiner();
            
            if (!useRefiners) {
                return true;
            }
            
            return refiners.every(refiner => {
                const values = valuesByRefiner.get(refiner);
                
                if (values) {
                    return values.some(v => selectedRefinerValues.has(v));
                } else if (!refiner.required) {
                    return selectedRefinerValues.has(refiner.blankValue);
                } else {
                    return true;
                }
            });
        });

    console.log('\n After Refiner Filter:', filteredEventOccurrences.length);
    filteredEventOccurrences.forEach((o, i) => console.log(`  [${i}] "${o.event.title}"`));
    console.log('=== EVENT FILTER END ===\n');

    return children(filteredEventOccurrences);
};
import React, { FC, useEffect, useRef, useState } from 'react';
import { EventOccurrence } from 'model';
import { useTimeZoneService } from 'services';
import moment from 'moment';
import 'bootstrap/dist/css/bootstrap.min.css';

interface EventDetailsListProps {
    cccurrences: readonly EventOccurrence[];
}

const EventDetailsList: FC<EventDetailsListProps> = ({ cccurrences }) => {
    const [filteredEvents, setFilteredEvents] = useState<EventOccurrence[]>([...cccurrences]);
    const [startDate, setStartDate] = useState<string>(moment().format('YYYY-MM-DD'));
    const [endDate, setEndDate] = useState<string>(moment().format('YYYY-MM-DD'));
    const [searchQuery, setSearchQuery] = useState<string>('');

    const timeZoneService = useTimeZoneService();
    const siteTimeZone = timeZoneService.siteTimeZone;

    useEffect(() => {
        let filtered = [...cccurrences]; // Create a mutable copy of the readonly array

        if (startDate || endDate) {
            // set the start date filter to the start of the day and set the timezone properly
            const start = startDate ? moment(startDate).startOf('day').tz(siteTimeZone.momentId, true) : null;
            // set the end date filter to the end of the day and set the timezone properly
            const end = endDate ? moment(endDate).endOf('day').tz(siteTimeZone.momentId, true) : null;

            filtered = filtered.filter(event => {
                const eventStart = moment(event.start);
                const eventEnd = moment(event.end);
        
                // Case 1: Both start and end are provided
                if (start && end) {
                    return (
                        eventStart.isBetween(start, end, null, '[]') ||   // Event starts within range
                        eventEnd.isBetween(start, end, null, '[]') ||     // Event ends within range
                        (eventStart.isBefore(start) && eventEnd.isAfter(end)) // Event overlaps the entire range
                    );
                }
        
                // Case 2: Only start date is provided (open-ended range from start)
                if (start) {
                    return eventEnd.isSameOrAfter(start); // Event ends on or after the start date
                }
        
                // Case 3: Only end date is provided (open-ended range up to end)
                if (end) {
                    return eventStart.isSameOrBefore(end); // Event starts on or before the end date
                }
        
                return true; // If no dates are provided, include the event
            });
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(event => {
                return (
                    event.title.toLowerCase().includes(query) ||
                    (event.description && event.description.toLowerCase().includes(query)) || 
                    Object.values(event).some(value =>
                        typeof value === 'string' && value.toLowerCase().includes(query)
                    )
                );
            });
        }

        // Sort the filtered events by start date
        filtered.sort((a, b) => moment(a.start).diff(moment(b.start)));

        setFilteredEvents(filtered);
        console.log('filtered events', filteredEvents);
    }, [startDate, endDate, searchQuery, cccurrences]);
  
    return (
        <div className="container">
            {/* Filters section */}
            <div className="row mb-3">
                <div className="col">
                    <label htmlFor="startDate">Start Date</label>
                    <input
                        type="date"
                        id="startDate"
                        className="form-control"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div className="col">
                    <label htmlFor="endDate">End Date</label>
                    <input
                        type="date"
                        id="endDate"
                        className="form-control"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
                <div className="col">
                    <label htmlFor="searchQuery">Search</label>
                    <input
                        type="text"
                        id="searchQuery"
                        className="form-control"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* table with sticky headers */}
            <div className="table-responsive" style={{ height: '600px', overflowY: 'auto' }}>
                <table className="table table-bordered table-striped">
                    <thead className="thead-dark sticky-top">
                        <tr>
                            <th>Type</th>
                            <th style={{ width: '200px' }}>Title</th>
                            <th>Decision Brief</th>
                            <th>Read Ahead Due Date</th>
                            <th style={{ width: '280px' }}>Event Date</th>                                                         
                            <th>IPC OPR</th>
                            <th>IPC Attendee</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEvents.map((event, index) => {
                            let eventDateFormatted;
                            
                            // all day and in one day. Example output: 1/1/2024 
                            if (event.isAllDay && event.start.format('MM/DD/YYYY') === event.end.format('MM/DD/YYYY')) {
                                eventDateFormatted = event.start.format('MM/DD/YYYY');
                            // all day and more than one day. Example output: 1/1/2024 - 1/3/2024
                            } else if(event.isAllDay && event.start.format('MM/DD/YYYY') !== event.end.format('MM/DD/YYYY')) { 
                                eventDateFormatted = event.start.format('MM/DD/YYYY') + " - " + event.end.format('MM/DD/YYYY');
                            // not all day and in one day. Example output: 1/1/2024 0600-0800
                            } else if (!event.isAllDay && event.start.format('MM/DD/YYYY') === event.end.format('MM/DD/YYYY')) {
                                eventDateFormatted = event.start.format('MM/DD/YYYY HHmm') + "-" + event.end.format('HHmm');
                            // not all day and more than one day. Example output: 1/1/2024 0600 - 1/3/2024 1400
                            } else if (!event.isAllDay && event.start.format('MM/DD/YYYY') !== event.end.format('MM/DD/YYYY')) {
                                eventDateFormatted = event.start.format('MM/DD/YYYY HHmm') + " - " + event.end.format('MM/DD/YYYY HHmm');    
                            } else {
                                eventDateFormatted = event.start.format('MM/DD/YYYY HHmm') + " - " + event.end.format('MM/DD/YYYY HHmm');
                            }                         

                            return (
                                <tr key={index}>
                                    <td>
                                        {event.getRefinerValuesForRefinerId(1).map((rv, index) => (
                                            <span
                                                key={index}
                                                style={{
                                                    backgroundColor: rv.color.toHexString(),
                                                    color: rv.color.isDarkColor() ? '#ffffff' : '#000000',
                                                    padding: '2px 4px',
                                                    borderRadius: '3px',
                                                    marginRight: '4px',
                                                    display: 'inline-block'
                                                }}
                                            >
                                                {rv.title}
                                            </span>
                                        ))}
                                    </td>
                                    <td style={{ width: '280px' }}>{event.title}</td>
                                    <td>
                                        {event.getRefinerValuesForRefinerName('Decision Brief').map(rv => (
                                            <div key={rv.title}>{rv.title}</div>
                                        ))}
                                    </td>
                                    <td>{event.readAheadDueDate ? event.readAheadDueDate.format('MM/DD/YYYY') : '-'}</td>
                                    <td style={{ width: '280px' }}>{eventDateFormatted}</td> 
                                    <td>
                                        {event.getRefinerValuesForRefinerName('IPC OPR').map(rv => (
                                            <div key={rv.title}>{rv.title}</div>
                                        ))}
                                    </td>
                                    <td>
                                        {event.getRefinerValuesForRefinerName('IPC Attendee').map(rv => (
                                            <div key={rv.title}>{rv.title}</div>
                                        ))}
                                    </td>
                                    <td style={{ whiteSpace: 'normal', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                                        {event.description}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default EventDetailsList;
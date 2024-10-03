import React, { FC, useEffect, useRef, useState } from 'react';
import { EventOccurrence } from 'model';
import moment from 'moment';
import 'bootstrap/dist/css/bootstrap.min.css';

interface EventDetailsListProps {
    cccurrences: readonly EventOccurrence[];
}

const EventDetailsList: FC<EventDetailsListProps> = ({ cccurrences }) => {
    const [filteredEvents, setFilteredEvents] = useState<EventOccurrence[]>([...cccurrences]);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');

    useEffect(() => {
        let filtered = [...cccurrences]; // Create a mutable copy of the readonly array

        if (startDate || endDate) {
            const start = startDate ? moment(startDate).startOf('day') : null;
            const end = endDate ? moment(endDate).endOf('day') : null;

            filtered = filtered.filter(event => {
                const eventStart = moment(event.start);
                const eventEnd = moment(event.end);

                // Check if event is within the date range or overlaps with it
                return (
                    (start && end && eventStart.isBetween(start, end, null, '[]')) ||  // Event starts within range
                    (start && end && eventEnd.isBetween(start, end, null, '[]')) ||    // Event ends within range
                    (start && end && eventStart.isBefore(start) && eventEnd.isAfter(end)) ||  // Event overlaps the entire range
                    (start && end && eventStart.isBefore(start) && eventEnd.isSameOrBefore(end) && eventEnd.isSameOrAfter(start)) // Event starts before start date and ends within the range
                );
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

            {/* Table section with sticky headers */}
            <div className="table-responsive" style={{ height: '600px', overflowY: 'auto' }}>
                <table className="table table-bordered table-striped">
                    <thead className="thead-dark sticky-top">
                        <tr>
                            <th>Type</th>
                            <th>Title</th>
                            <th>Decision Brief</th>
                            <th>Read Ahead Due Date</th>
                            <th>Start Date</th>
                            <th>End Date</th>                            
                            <th>IPC OPR</th>
                            <th>IPC Attendee</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEvents.map((event, index) => (
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
                                <td>{event.title}</td>
                                <td>
                                    {event.getRefinerValuesForRefinerName('Decision Brief').map(rv => (
                                        <div key={rv.title}>{rv.title}</div>
                                    ))}
                                </td>
                                <td>{event.readAheadDueDate ? event.readAheadDueDate.format('MM/DD/YYYY') : '-'}</td>
                                <td>{event.isAllDay ? event.start.format('MM/DD/YYYY') : event.start.format('MM/DD/YYYY HHmm')}</td>
                                <td>{event.isAllDay ? event.end.format('MM/DD/YYYY') : event.end.format('MM/DD/YYYY HHmm')}</td>
                                
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
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default EventDetailsList;
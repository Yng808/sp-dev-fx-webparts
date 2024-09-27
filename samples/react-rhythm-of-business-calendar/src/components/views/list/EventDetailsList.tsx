import React, { FC, useEffect, useRef, useState } from 'react';
import { DetailsList, DetailsListLayoutMode, IColumn, IDetailsListStyles, SelectionMode, Stack, TextField, Sticky, StickyPositionType, IDetailsHeaderProps, ScrollablePane, ScrollbarVisibility } from '@fluentui/react';
import { EventOccurrence } from 'model';
import moment from 'moment';

interface EventDetailsListProps {
    cccurrences: readonly EventOccurrence[];
}

// Define the custom header renderer with explicit types
const onRenderDetailsHeader = (props: IDetailsHeaderProps, defaultRender?: (props: IDetailsHeaderProps) => JSX.Element | null) => {
    if (!props || !defaultRender) {
        return null;
    }

    return (
        <Sticky>
            {defaultRender(props)}
        </Sticky>
    );
};

// custom table styles
const detailsListStyles: Partial<IDetailsListStyles> = {
    headerWrapper: {
        selectors: {
            '.ms-DetailsHeader': {
                backgroundColor: '#0078d4',  // Background color of the header row
                color: '#ffffff',            // Text color of the header row
            },
            '.ms-DetailsHeader-cellTitle': {
                color: '#ffffff',            // Text color of the header cell
            },
            '.ms-DetailsHeader-cell': {
                selectors: {
                    ':hover': {
                        backgroundColor: '#0078d4',  // Background color on hover
                        color: '#ffffff',            // Text color on hover
                    }
                }
            },
            '.ms-DetailsHeader-cellTitle:hover': {
                color: '#ffffff',  // Ensure text color stays white on hover
            }
        },
    },
};

const EventDetailsList: FC<EventDetailsListProps> = ({ cccurrences }) => {
    const [filteredEvents, setFilteredEvents] = useState<EventOccurrence[]>([...cccurrences]);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const scrollablePaneRef = useRef<HTMLDivElement | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);
   
   
     // Handle scroll events for the main content area
     const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
        const stickyElement = document.querySelector("[class*='stickyAbove-']");
        if (stickyElement) {
            stickyElement.scrollLeft = event.currentTarget.scrollLeft;
        }
    };

    // Handle scroll events for the sticky header
    const handleStickyScroll = (event: Event) => {
        const gridElement = document.querySelector("[class*='ms-DetailsList']");
        if (gridElement) {
            gridElement.scrollLeft = (event.target as HTMLElement).scrollLeft;
        }
    };

    useEffect(() => {
        const stickyElement = document.querySelector("[class*='stickyAbove-']");
        if (stickyElement) {
            stickyElement.addEventListener('scroll', handleStickyScroll);
        }

        // Cleanup event listener on component unmount
        return () => {
            if (stickyElement) {
                stickyElement.removeEventListener('scroll', handleStickyScroll);
            }
        };
    }, []);

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

    const columns: IColumn[] = [
        {
            key: 'column1',
            name: 'Type',
            fieldName: 'refinerValues',
            minWidth: 120,
            maxWidth: 150,
            isResizable: true,
            onRender: (item: EventOccurrence) => {
                const refinerValues = item.getRefinerValuesForRefinerId(1);
                return (
                    <div>
                        {refinerValues.map((rv, index) => {
                            const backgroundColor = rv.color.toHexString();
                            const textColor = rv.color.isDarkColor() ? '#ffffff' : '#000000'; // Use the method from the Color class
        
                            return (
                                <span
                                    key={index}
                                    style={{
                                        backgroundColor: backgroundColor,
                                        color: textColor,  // Set text color based on the color's luminance
                                        padding: '2px 4px',
                                        borderRadius: '3px',
                                        marginRight: '4px',
                                        display: 'inline-block'
                                    }}
                                >
                                    {rv.title}
                                </span>
                            );
                        })}
                    </div>
                );
            }
        },
        
        {
            key: 'column2',
            name: 'Title',
            fieldName: 'title',
            minWidth: 250,
            maxWidth: 300,
            isResizable: true,
            onRender: (item: EventOccurrence) => item.title,
        },   
        {
            key: 'column10',
            name: 'Decision Brief',
            fieldName: 'refinerValues',
            minWidth: 120,
            maxWidth: 150,
            isResizable: true,
            onRender: (item: EventOccurrence) => {
                const refinerValues = item.getRefinerValuesForRefinerName('Decision Brief');
                return (
                    <div>
                        {refinerValues.map((rv) => (
                            <div key={rv.title}>{rv.title}</div>
                        ))}
                    </div>
                );
            }
        },     
        {
            key: 'column3',
            name: 'Start Date',
            fieldName: 'startDate',
            minWidth: 100,
            maxWidth: 150,
            isResizable: true,
            onRender: (item: EventOccurrence) => item.isAllDay ? item.start.format('MM/DD/YYYY') : item.start.format('MM/DD/YYYY HHmm'),
        },
        {
            key: 'column4',
            name: 'End Date',
            fieldName: 'endDate',
            minWidth: 100,
            maxWidth: 150,
            isResizable: true,
            onRender: (item: EventOccurrence) => item.isAllDay ? item.end.format('MM/DD/YYYY') : item.end.format('MM/DD/YYYY HHmm'),
        },
        /* {
            key: 'column4',
            name: 'COM Decision',
            fieldName: 'comDecision',
            minWidth: 100,
            maxWidth: 150,
            isResizable: true,
            onRender: (item: EventOccurrence) => item.comDecision,
        }, */
        
        {
            key: 'column5',
            name: 'Read Ahead Due Date',
            fieldName: 'readAheadDueDate',
            minWidth: 100,
            maxWidth: 150,
            isResizable: true,
            onRender: (item: EventOccurrence) => item.readAheadDueDate ? item.readAheadDueDate.format('MM/DD/YYYY') : '-',
        },
        {
            key: 'column6',
            name: 'IPC OPR',
            fieldName: 'refinerValues',
            minWidth: 120,
            maxWidth: 150,
            isResizable: true,
            onRender: (item: EventOccurrence) => {
                const refinerValues = item.getRefinerValuesForRefinerName('IPC OPR');
                return (
                    <div>
                        {refinerValues.map((rv) => (
                            <div key={rv.title}>{rv.title}</div>
                        ))}
                    </div>
                );
            }
        },
        {
            key: 'column7',
            name: 'IPC Attendee',
            fieldName: 'refinerValues',
            minWidth: 120,
            maxWidth: 150,
            isResizable: true,
            onRender: (item: EventOccurrence) => {
                const refinerValues = item.getRefinerValuesForRefinerName('IPC Attendee');
                return (
                    <div>
                        {refinerValues.map((rv) => (
                            <div key={rv.title}>{rv.title}</div>
                        ))}
                    </div>
                );
            }
        },
        {
            key: 'column8',
            name: 'Description',
            fieldName: 'description',
            minWidth: 200,
            maxWidth: 400,
            isResizable: true,
            onRender: (item: EventOccurrence) => {
                return (
                    <span
                        style={{
                            whiteSpace: 'normal',  // Allow text to wrap to the next line
                            wordWrap: 'break-word',  // Break long words to prevent overflow
                            overflowWrap: 'break-word',  // Handles overflow in long words
                        }}
                    >
                        {item.description}
                    </span>
                );
            },
        },
        
        
        // Add more columns as needed for other text-based fields
    ];


  

    return (
        <div style={{ position: 'relative', height: '600px', overflow: 'auto' }} onScroll={handleScroll}
        ref={scrollablePaneRef}>
            <ScrollablePane scrollbarVisibility={ScrollbarVisibility.auto}>
                {/* Filters section */}
                <Stack tokens={{ childrenGap: 10 }}>
                    <Stack horizontal tokens={{ childrenGap: 10 }}>
                        <TextField
                            label="Start Date"
                            type="date"
                            value={startDate}
                            onChange={(e, newValue) => setStartDate(newValue || '')}
                        />
                        <TextField
                            label="End Date"
                            type="date"
                            value={endDate}
                            onChange={(e, newValue) => setEndDate(newValue || '')}
                        />
                        <TextField
                            label="Search"
                            value={searchQuery}
                            onChange={(e, newValue) => setSearchQuery(newValue || '')}
                        />
                    </Stack>
                </Stack>

                {/* DetailsList section */}
                <div ref={listRef}>
                    <DetailsList
                        items={filteredEvents}
                        columns={columns}
                        setKey="set"
                        layoutMode={DetailsListLayoutMode.fixedColumns}
                        selectionPreservedOnEmptyClick={true}
                        ariaLabelForSelectionColumn="Toggle selection"
                        checkButtonAriaLabel="Row checkbox"
                        styles={detailsListStyles}
                        selectionMode={SelectionMode.none}
                        onRenderDetailsHeader={onRenderDetailsHeader}
                    />
                </div>
            </ScrollablePane>
        </div>
        
    );
};

export default EventDetailsList;
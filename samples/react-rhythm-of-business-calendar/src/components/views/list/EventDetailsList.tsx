import React, { FC, useEffect, useState } from 'react';
import { DetailsList, DetailsListLayoutMode, IColumn, IDetailsListStyles, SelectionMode, Stack, TextField } from '@fluentui/react';
import { EventOccurrence } from 'model';
import moment from 'moment';

interface EventDetailsListProps {
    cccurrences: readonly EventOccurrence[];
}

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

    useEffect(() => {
        let filtered = [...cccurrences]; // Create a mutable copy of the readonly array

        if (startDate) {
            const start = moment(startDate);
            filtered = filtered.filter(event => event.start.isSameOrAfter(start));
        }

        if (endDate) {
            const end = moment(endDate).endOf('day');
            filtered = filtered.filter(event => event.end.isSameOrBefore(end));
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

        setFilteredEvents(filtered);
    }, [startDate, endDate, searchQuery, cccurrences]);

    const columns: IColumn[] = [
        {
            key: 'column1',
            name: 'Title',
            fieldName: 'title',
            minWidth: 150,
            maxWidth: 200,
            isResizable: true,
            onRender: (item: EventOccurrence) => item.title,
        },
        {
            key: 'column2',
            name: 'Start Date',
            fieldName: 'startDate',
            minWidth: 100,
            maxWidth: 150,
            isResizable: true,
            onRender: (item: EventOccurrence) => item.start.format('YYYY-MM-DD'),
        },
        {
            key: 'column3',
            name: 'End Date',
            fieldName: 'endDate',
            minWidth: 100,
            maxWidth: 150,
            isResizable: true,
            onRender: (item: EventOccurrence) => item.end.format('YYYY-MM-DD'),
        },
        // Add more columns as needed for other text-based fields
    ];

    return (
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
            />
        </Stack>
    );
};

export default EventDetailsList;
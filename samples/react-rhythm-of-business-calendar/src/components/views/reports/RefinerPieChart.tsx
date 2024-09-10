import React, { FC, useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { EventOccurrence } from 'model';
import { DetailsList, DetailsListLayoutMode, IColumn, IDetailsListStyles, SelectionMode, Stack } from '@fluentui/react';
import moment from 'moment';
import { Color } from 'common';

interface RefinerPieChartProps {
    cccurrences: readonly EventOccurrence[];
}


// Filter function definitions
const filterEventsForFYTD = (cccurrences: readonly EventOccurrence[]) => {
    if (!cccurrences || cccurrences.length === 0) {
        return []; // Return an empty array if cccurrences is null
    }

    
    const cccurrenceTimezone = cccurrences[0].start.tz();
    const currentDate = moment().tz(cccurrenceTimezone, true);    
    const fiscalYearStart = moment(currentDate).month(9).date(1).startOf('day'); // October 1 of the previous fiscal year
    if (currentDate.month() < 9) {
        fiscalYearStart.subtract(1, 'year'); // If current month is before October, subtract one year
    }
    const fiscalYearEnd = currentDate.clone().endOf('day'); // End of the current date
     //console.log('Inside RefinerPieChart currentDate:',currentDate);
     //console.log('Inside RefinerPieChart fiscalYearStart', fiscalYearStart);
     //console.log('Inside RefinerPieChart fiscalYearEnd', fiscalYearEnd);
     //console.log('Inside RefinerPieChart cccurrences', cccurrences);

    return cccurrences.filter(cccurrence => {
        const eventStartDate = cccurrence.start;
        const eventEndDate = cccurrence.end;
        return (eventStartDate.isBefore(fiscalYearEnd) && eventEndDate.isAfter(fiscalYearStart));
    });
};

const filterEventsForPreviousMonth = (cccurrences: readonly EventOccurrence[]) => {

    if (!cccurrences || cccurrences.length === 0) {
        return []; // Return an empty array if cccurrences is null
    }

    const cccurrenceTimezone = cccurrences[0].start.tz();
    const currentDate = moment().tz(cccurrenceTimezone, true);
    const previousMonthStart = currentDate.clone().subtract(1, 'month').startOf('month');
    const previousMonthEnd = previousMonthStart.clone().endOf('month');

    return cccurrences.filter(cccurrence => {
        const eventStartDate = cccurrence.start;
        const eventEndDate = cccurrence.end;
        return (eventStartDate.isBefore(previousMonthEnd) && eventEndDate.isAfter(previousMonthStart));
    });
};

const filterEventsForCurrentMonth = (cccurrences: readonly EventOccurrence[]) => {
    if (!cccurrences || cccurrences.length === 0) {
        return []; // Return an empty array if cccurrences is null
    }

    const cccurrenceTimezone = cccurrences[0].start.tz();
    const currentDate = moment().tz(cccurrenceTimezone, true);
    const currentMonthStart = currentDate.clone().startOf('month');
    const currentMonthEnd = currentDate.clone().endOf('month');
    //console.log('currentMonthStart:', currentMonthStart);
    //console.log('currentMonthEnd', currentMonthEnd);

    //console.log('cccurrences:', cccurrences);

    return cccurrences.filter(cccurrence => {
        const eventStartDate = cccurrence.start;
        const eventEndDate = cccurrence.end;
        //console.log('eventStartDate:', eventStartDate);
        //console.log('eventEnd:', eventEndDate);
        return (eventStartDate.isBefore(currentMonthEnd) && eventStartDate.isSameOrAfter(currentMonthStart) && eventEndDate.isAfter(currentMonthStart) && eventEndDate.isSameOrBefore(currentMonthEnd));
    });
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


const getCurrentAndPreviousMonthNames = () => {
    const currentDate = new Date();
    const currentMonthName = currentDate.toLocaleString('default', { month: 'long' });

    const previousDate = new Date(currentDate);
    previousDate.setMonth(currentDate.getMonth() - 1);
    const previousMonthName = previousDate.toLocaleString('default', { month: 'long' });

    return { currentMonthName, previousMonthName };
};

const RefinerPieChart: FC<RefinerPieChartProps> = ({ cccurrences }) => {
    //console.log('cccurences in RefinerPiechart:', cccurrences);
    // const [data, setData] = useState<{ labels: string[], values: number[], colors: string[], items: any[] }>({
    //     labels: [],
    //     values: [],
    //     colors: [],
    //     items: []
    // });

    const [fytdData, setFytdData] = useState<{ labels: string[], values: number[], colors: string[], items: any[] }>({ labels: [], values: [], colors: [], items: [] });
    const [previousMonthData, setPreviousMonthData] = useState<{ labels: string[], values: number[], colors: string[], items: any[] }>({ labels: [], values: [], colors: [], items: [] });
    const [currentMonthData, setCurrentMonthData] = useState<{ labels: string[], values: number[], colors: string[], items: any[] }>({ labels: [], values: [], colors: [], items: [] });
    const { currentMonthName, previousMonthName } = getCurrentAndPreviousMonthNames();

    const getFilteredData = (filteredEvents: readonly EventOccurrence[]) => {
        const refinerValueCounts: { [key: string]: { count: number, color: string } } = {};

        // Count the occurrences by refiner value
        filteredEvents.forEach(cccurrence => {
            //console.log(cccurrence.start.date);
            const valuesByRefiner = cccurrence.event.valuesByRefiner();
            valuesByRefiner.forEach((values, refiner) => {
                if (refiner.id === 1) { // hard coded the specific refiner to look at for now
                    values.forEach(value => {
                        const refinerValue = value.title;
                        if (!refinerValueCounts[refinerValue]) {
                            refinerValueCounts[refinerValue] = { count: 0, color: value.color.toHexString() };
                        }
                        refinerValueCounts[refinerValue].count += 1;
                    });
                }
            });
        });

        // Prepare data for the pie chart and table
        const labels = Object.keys(refinerValueCounts);
        const values = labels.map(label => refinerValueCounts[label].count);
        const colors = labels.map(label => refinerValueCounts[label].color);
        const total = values.reduce((sum, value) => sum + value, 0);
        const items = labels.map((label, index) => ({
            key: index,
            refinerValue: label,
            count: values[index],
            percentage: `${((values[index] / total) * 100).toFixed(2)}%`,
            color: colors[index],
        }));

        return { labels, values, colors, items };
    };

    useEffect(() => {
        // Filter and sort data for FYTD with default sort on 'count' in descending order
        const sortedFytdData = getFilteredData(filterEventsForFYTD(cccurrences));
        sortedFytdData.items.sort((a, b) => b.count - a.count);
        setFytdData(sortedFytdData);

        // Filter and sort data for the previous month with default sort on 'count' in descending order
        const sortedPreviousMonthData = getFilteredData(filterEventsForPreviousMonth(cccurrences));
        sortedPreviousMonthData.items.sort((a, b) => b.count - a.count);
        setPreviousMonthData(sortedPreviousMonthData);

        // Filter and sort data for the current month with default sort on 'count' in descending order
        const sortedCurrentMonthData = getFilteredData(filterEventsForCurrentMonth(cccurrences));
        sortedCurrentMonthData.items.sort((a, b) => b.count - a.count);
        setCurrentMonthData(sortedCurrentMonthData);

    }, [cccurrences]);

    


    const columns: IColumn[] = [
        {
            key: 'column1',
            name: 'Type',
            fieldName: 'refinerValue',
            minWidth: 200,
            maxWidth: 200,
            isResizable: false,
            onRender: (item) => {
                const color = Color.parse(item.color);
                const textColor = color.isDarkColor() ? '#ffffff' : '#000000';

                return (
                    <div 
                        style={{ 
                            backgroundColor: item.color, 
                            color: textColor,
                            padding: '2px 4px',
                            borderRadius: '3px',
                            marginRight: '4px',
                            display: 'inline-block'
                        }}
                    >
                        {item.refinerValue}
                    </div>
                );
            },
        },
        {
            key: 'column2',
            name: 'Count',
            fieldName: 'count',
            minWidth: 100,
            maxWidth: 100,
            isResizable: false,
        },
        {
            key: 'column3',
            name: 'Percentage',
            fieldName: 'percentage',
            minWidth: 100,
            maxWidth: 100,
            isResizable: false,
        }
    ];

    const renderChartAndTable = (title: string, data: { labels: string[], values: number[], colors: string[], items: any[] }) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <Plot
                        data={[
                            {
                                type: 'pie',
                                labels: data.labels,
                                values: data.values,
                                textinfo: 'label+value+percent',  
                                textposition: 'outside',
                                pull: 0.02,
                                marker: {
                                    colors: data.colors,                                    
                                },
                                textfont: {
                                    size: 12,
                                    color: '#000000',
                                    family: 'Arial, sans-serif'
                                },
                                hoverinfo: 'label+value+percent',  
                                automargin: true,
                               
                            },
                        ]}
                        layout={{ 
                            title: {
                                text: title,
                                x: 0.5,  // Center the title
                                xanchor: 'center',
                                pad: {
                                    b: 10
                                },
                                font: {
                                    size: 24,  // Set the font size
                                    family: 'Arial, sans-serif',  // Optionally set the font family
                                    color: '#000000',  // Optionally set the color
                                },
                                                               
                            }, 
                            showlegend: false,
                            legend: {
                                orientation: 'h',  
                                x: 0.5,            // Center the legend horizontally
                                xanchor: 'center', // Align legend center to x position
                                y: -1,            // Move the legend below the chart
                                yanchor:'top',
                                font: {
                                    size: 10,
                                },
                                
                            },
                            margin: { t: 150, b: 100, l: 20, r: 20 },
                            height: 620, 
                            width: 500,
                            
                        }}
                        style={{ width: '100%', height: '100%' }}
                    />
                    <DetailsList
                            items={data.items}
                            columns={columns}
                            setKey="set"
                            layoutMode={DetailsListLayoutMode.fixedColumns}
                            selectionPreservedOnEmptyClick={true}
                            ariaLabelForSelectionColumn="Toggle selection"
                            checkButtonAriaLabel="Row checkbox"
                            styles={detailsListStyles}
                            selectionMode={SelectionMode.none} 
                    />
            </div>
    );

    return (
        <Stack
            horizontal
            wrap
            tokens={{ childrenGap: 10 }}
            styles={{
                root: {
                    marginTop: 20,
                    display: 'flex',
                    justifyContent: 'center',  // Center the charts within the container
                    alignItems: 'flex-start',  // Align items at the top
                    flexWrap: 'wrap',          // Allow wrapping if necessary
                    '@media (max-width: 1024px)': { // Medium screens (e.g., tablets)
                        flexDirection: 'column',
                        alignItems: 'center',
                    },
                    '@media (min-width: 1025px)': { // Larger screens
                        justifyContent: 'space-between',
                    },
                },
            }}
        >
            <Stack.Item grow styles={{ root: { width: 400, textAlign: 'center' } }}>
                {renderChartAndTable("FYTD", fytdData)}
            </Stack.Item>
            <Stack.Item grow styles={{ root: { width: 400, textAlign: 'center' } }}>
                {renderChartAndTable(previousMonthName, previousMonthData)}
            </Stack.Item>
            <Stack.Item grow styles={{ root: { width: 400, textAlign: 'center' } }}>
                {renderChartAndTable(currentMonthName, currentMonthData)}
            </Stack.Item>
        </Stack>
    );
};

export default RefinerPieChart;

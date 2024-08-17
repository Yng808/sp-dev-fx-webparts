import React, { FC, useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { EventOccurrence } from 'model';
import { DetailsList, DetailsListLayoutMode, IColumn, Stack } from '@fluentui/react';

interface RefinerPieChartProps {
    cccurrences: readonly EventOccurrence[];
}

const RefinerPieChart: FC<RefinerPieChartProps> = ({ cccurrences }) => {
    const [data, setData] = useState<{ labels: string[], values: number[], items: any[] }>({
        labels: [],
        values: [],
        items: []
    });

    const [sortColumn, setSortColumn] = useState<string | undefined>(undefined);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');


    useEffect(() => {
        const refinerValueCounts: { [key: string]: number } = {};
        
        // Count the occurrences by refiner value
        cccurrences.forEach(cccurrence => {
            const valuesByRefiner = cccurrence.event.valuesByRefiner();
            valuesByRefiner.forEach((values, refiner) => {
                if (refiner.id === 1) {
                    values.forEach(value => {
                        const refinerValue = value.title;
                        refinerValueCounts[refinerValue] = (refinerValueCounts[refinerValue] || 0) + 1;
                    });
                }                
            });
        });

        // Prepare data for the pie chart and table
        const labels = Object.keys(refinerValueCounts);
        const values = Object.values(refinerValueCounts);
        const total = values.reduce((sum, value) => sum + value, 0);
        const items = labels.map((label, index) => ({
            key: index,
            refinerValue: label,
            count: values[index],
            percentage: `${((values[index] / total) * 100).toFixed(2)}%`
        }));

        setData({ labels, values, items });
    }, [cccurrences]);


    const onColumnClick = (ev: React.MouseEvent<HTMLElement>, column: IColumn): void => {
        const newDirection = sortColumn === column.key && sortDirection === 'asc' ? 'desc' : 'asc';
        const sortedItems = [...data.items].sort((a, b) => {
            if (newDirection === 'asc') {
                return a[column.fieldName as keyof typeof a] > b[column.fieldName as keyof typeof a] ? 1 : -1;
            } else {
                return a[column.fieldName as keyof typeof a] < b[column.fieldName as keyof typeof a] ? 1 : -1;
            }
        });

        setData({ ...data, items: sortedItems });
        setSortColumn(column.key);
        setSortDirection(newDirection);
    };

    const columns: IColumn[] = [
        {
            key: 'column1',
            name: 'Refiner Value',
            fieldName: 'refinerValue',
            minWidth: 100,
            maxWidth: 200,
            isResizable: false,
            isSorted: sortColumn === 'refinerValue',
            isSortedDescending: sortColumn === 'refinerValue' && sortDirection === 'desc',
            onColumnClick: onColumnClick,
        },
        {
            key: 'column2',
            name: 'Count',
            fieldName: 'count',
            minWidth: 50,
            maxWidth: 100,
            isResizable: false,
            isSorted: sortColumn === 'count',
            isSortedDescending: sortColumn === 'count' && sortDirection === 'desc',
            onColumnClick: onColumnClick,
        },
        {
            key: 'column3',
            name: 'Percentage',
            fieldName: 'percentage',
            minWidth: 50,
            maxWidth: 150,
            isResizable: false,
            isSorted: sortColumn === 'percentage',
            isSortedDescending: sortColumn === 'percentage' && sortDirection === 'desc',
            onColumnClick: onColumnClick,
        }
    ];

    const renderChartAndTable = () => (
        <div>
                    <Plot
                        data={[
                            {
                                type: 'pie',
                                labels: data.labels,
                                values: data.values,
                                textinfo: 'label+value+percent',  
                                textposition: 'outside',
                                pull: 0.05,
                                marker: {
                                    line: {
                                        color: '#000000', // Optional: color of slice borders
                                        width: 1
                                    }
                                },
                                hoverinfo: 'label+value+percent',  
                                automargin: true,
                            },
                        ]}
                        layout={{ 
                            title: {
                                text:'Event Types Distribution',
                                pad: {
                                    b: 20
                                }
                                
                            }, 
                            showlegend: true,
                            legend: {
                                orientation: 'h',  // Horizontal legend
                                x: 0.5,            // Center the legend horizontally
                                xanchor: 'center', // Align legend center to x position
                                y: -0.4            // Move the legend below the chart
                            },
                            margin: { t: 80, b: 70, l: 30, r: 30 } 
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
                {renderChartAndTable()}
            </Stack.Item>
            <Stack.Item grow styles={{ root: { width: 400, textAlign: 'center' } }}>
                {renderChartAndTable()}
            </Stack.Item>
            <Stack.Item grow styles={{ root: { width: 400, textAlign: 'center' } }}>
                {renderChartAndTable()}
            </Stack.Item>
        </Stack>
    );
};

export default RefinerPieChart;

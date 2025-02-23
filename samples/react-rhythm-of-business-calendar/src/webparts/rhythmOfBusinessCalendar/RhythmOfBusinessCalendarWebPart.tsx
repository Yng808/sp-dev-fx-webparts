import React from 'react';
import ReactDom from "react-dom";
import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IPropertyPaneConfiguration, PropertyPaneTextField } from '@microsoft/sp-property-pane';
import { RhythmOfBusinessCalendarApp } from 'apps';
import { FilterConfigContext } from 'components/shared/FilterConfigContext';

import * as strings from 'RhythmOfBusinessCalendarWebPartStrings';
import './RhythmOfBusinessCalendar.module.scss';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import 'bootstrap/dist/css/bootstrap.min.css';

console.log('html2canvas:', html2canvas);
console.log('jsPDF:', jsPDF);

export interface IWebPartProps {
    filterButtonsJson: string;
}

export default class RhythmOfBusinessCalendarWebPart extends BaseClientSideWebPart<IWebPartProps> {
    public render(): void {
        let filterButtons = [];
        try {
            // Parse the JSON string from the web part property.
            filterButtons = JSON.parse(this.properties.filterButtonsJson);
        } catch (error) {
            console.error('Error parsing filterButtonsJson:', error);
        }
        
        ReactDom.render(
            <div>
                <button
                    onClick={this.generatePDF}
                    className="btn btn-primary mb-3 ms-3"
                >
                    Download as PDF
                </button>
                <FilterConfigContext.Provider value={{ filterButtons }}>
                    <RhythmOfBusinessCalendarApp webpart={this} />
                </FilterConfigContext.Provider>
            </div>,
            this.domElement
        );
    }

    private generatePDF = () => {
        const input = this.domElement.querySelector('div[class^="ms-Shimmer-container root-"]') as HTMLElement;
        console.log('input: ', input);
        if (input) {
            
          html2canvas(input).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            
            // Create jsPDF instance in landscape mode
            const pdf = new jsPDF('landscape');
            
            // PDF dimensions
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            // Image dimensions
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            
            // Calculate scale to fit the image within the page
            const scale = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
            const scaledWidth = imgWidth * scale;
            const scaledHeight = imgHeight * scale;
            
            // Center the image on the PDF page
            const x = (pageWidth - scaledWidth) / 2;
            const y = (pageHeight - scaledHeight) / 2;
      
            // Add the image to the PDF
            pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);
            
            // Save the PDF
            pdf.save('BridgeCalendar.pdf');
          });
        }
      };


    protected onDispose(): void {
        ReactDom.unmountComponentAtNode(this.domElement);
    }

    protected get dataVersion(): Version {
        return Version.parse('1.0');
    }

    protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
        return {
            pages: [
                {
                    header: {
                        description: strings.PropertyPane.Heading
                    },
                    groups: [
                        {
                            groupName: "Filter Button Settings",
                            groupFields: [
                              PropertyPaneTextField('filterButtonsJson', {
                                label: "Filter Buttons JSON",
                                multiline: true,
                                resizable: true,
                                description: "Enter a JSON array of filter button configurations. For example: " +
                                  `[{"key": "filter-refiners", "text": "Filter refiners starting with A", "filterPrefixes": "Birthday;Work Meeting;No;109", "iconName": "Filter"}]`
                              })
                            ]
                          }
                    ]
                }
            ]
        };
    }
}
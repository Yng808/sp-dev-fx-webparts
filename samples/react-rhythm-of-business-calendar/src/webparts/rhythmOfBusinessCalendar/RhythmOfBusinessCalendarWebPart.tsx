import React from 'react';
import ReactDom from "react-dom";
import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IPropertyPaneConfiguration, PropertyPaneCheckbox, PropertyPaneTextField } from '@microsoft/sp-property-pane';
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
    showOPR: boolean;
    showAttendee: boolean;
    showReadAheadDueDate: boolean;
    showDecisionBrief: boolean;
    showLocation: boolean;
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
        
        let showOPR = this.properties.showOPR !== undefined ? this.properties.showOPR : true;
        let showAttendee = this.properties.showAttendee !== undefined ? this.properties.showAttendee : true;
        let showReadAheadDueDate = this.properties.showReadAheadDueDate !== undefined ? this.properties.showReadAheadDueDate : true;
        let showDecisionBrief = this.properties.showDecisionBrief !== undefined ? this.properties.showDecisionBrief : true;
        let showLocation = this.properties.showLocation !== undefined ? this.properties.showLocation : true;

        ReactDom.render(
            <div>
                <button
                    onClick={this.generatePDF}
                    className="btn btn-primary mb-3 ms-3"
                >
                    Download as PDF
                </button>
                <FilterConfigContext.Provider value={{ filterButtons, showOPR, showAttendee, showReadAheadDueDate, showDecisionBrief, showLocation }}>
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
                          },
                          {
                            groupName: "List View / Tab Settings",
                            groupFields: [                              
                              PropertyPaneCheckbox('showOPR', { 
                                text: "Show OPR column on list view",
                                checked: true                                
                              }),
                              PropertyPaneCheckbox('showAttendee', { 
                                text: "Show OPR Attendee column on list view",
                                checked: true                                
                              }),
                              PropertyPaneCheckbox('showReadAheadDueDate', { 
                                text: "Show Read Ahead Due Date column on list view",
                                checked: true                                
                              }),
                              PropertyPaneCheckbox('showDecisionBrief', { 
                                text: "Show Decision Brief column on list view",
                                checked: true                                
                              }),
                              PropertyPaneCheckbox('showLocation', { 
                                text: "Show Location column on list view",
                                checked: true                                
                              })
                            ]
                          }

                    ]
                }
            ]
        };
    }
}
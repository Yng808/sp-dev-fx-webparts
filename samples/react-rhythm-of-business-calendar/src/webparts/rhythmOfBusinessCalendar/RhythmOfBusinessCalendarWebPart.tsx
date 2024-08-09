import React from 'react';
import ReactDom from "react-dom";
import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import { RhythmOfBusinessCalendarApp } from 'apps';

import * as strings from 'RhythmOfBusinessCalendarWebPartStrings';
import './RhythmOfBusinessCalendar.module.scss';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import 'bootstrap/dist/css/bootstrap.min.css';

console.log('html2canvas:', html2canvas);
console.log('jsPDF:', jsPDF);

export interface IWebPartProps {
}

export default class RhythmOfBusinessCalendarWebPart extends BaseClientSideWebPart<IWebPartProps> {
    public render(): void {
        ReactDom.render(
            <div>
              <button onClick={this.generatePDF} className="btn btn-primary mb-3">Download as PDF</button>
              <RhythmOfBusinessCalendarApp webpart={this} />
            </div>,
            this.domElement
          );
    }

    private generatePDF = () => {
        const input = this.domElement.querySelector('.ms-Shimmer-container.root-73') as HTMLElement;
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
            pdf.save('webpart.pdf');
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
                    ]
                }
            ]
        };
    }
}
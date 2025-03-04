import React from 'react';

export interface IFilterButtonConfig {
  key: string;
  text: string;
  filterPrefixes: string; // semicolon-delimited string e.g. "Birthday;Work Meeting;No;109"
  iconName: string;
}

export interface IFilterConfigContext {
  filterButtons: IFilterButtonConfig[];
  showOPR: boolean;
  showAttendee: boolean;
  showReadAheadDueDate: boolean;
  showDecisionBrief: boolean;
  showLocation: boolean
}

export const FilterConfigContext = React.createContext<IFilterConfigContext>({
  filterButtons: [],
  showOPR: true,
  showAttendee: true,
  showReadAheadDueDate: true,
  showDecisionBrief: true,
  showLocation: true
});
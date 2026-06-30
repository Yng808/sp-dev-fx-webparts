import React from 'react';

export interface IEmailSettings {
  subjectPrefix: string;
  phone: string;
  email: string;
  signature: string;
}

export const EmailSettingsContext = React.createContext<IEmailSettings>({
  subjectPrefix: '',
  phone: '',
  email: '',
  signature: ''
});

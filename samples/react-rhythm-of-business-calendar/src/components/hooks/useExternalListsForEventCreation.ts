import { useEventsService } from 'services';
import { ExternalListConfig } from 'model/ExternalListConfig';

export interface IEventCreationOption {
    key: string;
    text: string;
    iconProps?: { iconName: string };
    isExternal: boolean;
    listId?: string;
    siteUrl?: string;
}

export const useExternalListsForEventCreation = () => {
    const eventsService = useEventsService();
    
        const opts: IEventCreationOption[] = [
            {
                key: 'internal',
                text: 'Add Event',
                iconProps: { iconName: 'Add' },
                isExternal: false
            }
        ];
        
        try {
            const configs = eventsService.externalListsLoader.getCachedConfigs();
            
            configs.filter(c => c.enabled).forEach((config: ExternalListConfig) => {
                opts.push({
                    key: config.listId,
                    text: `Add ${config.title} Event`,
                    iconProps: { iconName: 'Add' },
                    isExternal: true,
                    listId: config.listId,
                    siteUrl: config.siteUrl
                });
            });
        } catch (error) {
            console.warn('Could not load external list configs', error);
        }
        
        return opts;
};
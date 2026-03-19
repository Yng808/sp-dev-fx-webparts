import * as React from 'react';
import { Dropdown, IDropdownOption, IDropdownStyles } from 'office-ui-fabric-react/lib/components/Dropdown';

interface IAsyncDropdownProps {
    label?: string;
    loadOptions: () => Promise<IDropdownOption[]>;
    onChange: (option?: IDropdownOption) => void;
    selectedKey?: string | number;
    disabled: boolean;
    stateKey?: string;
    forceNoDelay?: boolean;
    onError?: (message: string) => void;
}

interface IAsyncDropdownState {
    loading: boolean;
    options: IDropdownOption[];
    error?: string;
}

export default class PropertyPaneAsyncDropdown extends React.Component<IAsyncDropdownProps, IAsyncDropdownState> {
    private _selectedKey: React.ReactText | undefined;

    constructor(props: IAsyncDropdownProps) {
        super(props);

        this._selectedKey = props.selectedKey;
        this.state = {
            loading: false,
            options: []
        };
    }

    public componentDidMount(): void {
        if (!this.props.stateKey) {
            return;
        }

        this._loadOptions(true);
    }

    public componentDidUpdate(prevProps: IAsyncDropdownProps): void {
        if ((this.props.selectedKey === null || this.props.selectedKey === undefined) &&
            this._selectedKey !== null &&
            this._selectedKey !== undefined &&
            this._selectedKey !== "temp") {
            this._selectedKey = undefined;
        }

        if (!this.props.stateKey) {
            this._selectedKey = undefined;
            return;
        }

        if (this.props.disabled !== prevProps.disabled || this.props.stateKey !== prevProps.stateKey) {
            this._loadOptions(this.props.forceNoDelay);
        }
    }

    private _loadOptions(noDelay?: boolean): void {
        const currentStateKey = this.props.stateKey;
        const timeoutTime = noDelay ? 0 : 1500;

        window.setTimeout(() => {
            if (currentStateKey !== this.props.stateKey) {
                return;
            }

            this.setState({
                loading: true,
                error: undefined
            });

            this.props.loadOptions()
                .then((options: IDropdownOption[]): void => {
                    this.setState({
                        loading: false,
                        error: undefined,
                        options
                    });
                    this._selectedKey = this.props.selectedKey;

                    if (this.props.onError) {
                        this.props.onError('');
                    }
                }, (error: any): void => {
                    this.setState({
                        loading: false,
                        error: error?.message || String(error),
                        options: []
                    });
                    this._selectedKey = undefined;

                    if (this.props.onError) {
                        this.props.onError(error?.message || String(error));
                    }

                    if (this.props.onChange) {
                        this.props.onChange(undefined);
                    }
                });
        }, timeoutTime);
    }

    public render(): JSX.Element {
        const dropdownStyles: Partial<IDropdownStyles> = {
            dropdown: { minWidth: 125, width: '100%' }
        };

        return (
            <Dropdown
                label={this.props.label}
                disabled={this.props.disabled || !this.props.stateKey || this.state.loading || this.state.error !== undefined}
                onChange={this._onChange}
                selectedKey={this._selectedKey}
                styles={dropdownStyles}
                options={this.state.options}
            />
        );
    }

    private readonly _onChange = (_event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
        this._selectedKey = option?.key;

        const options = this.state.options.map((existingOption: IDropdownOption) => ({
            ...existingOption,
            selected: existingOption.key === option?.key
        }));

        this.setState({
            options
        });

        if (this.props.onChange) {
            this.props.onChange(option);
        }
    };
}

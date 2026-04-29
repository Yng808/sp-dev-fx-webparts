import { ListItemEntity } from "common/sharepoint";

interface IState {
    value: string;
}

export class EmailSetting extends ListItemEntity<IState> {
    constructor(...args: any[]) {
        super(...args);
        this.state.value = '';
    }

    public get key(): string {
        return this.title;
    }

    public get value(): string {
        return this.state.value;
    }

    public set value(val: string) {
        this.state.value = val;
    }
}
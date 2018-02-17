import { combineReducers } from 'redux';

export enum ToggleAction {
  Toggle = "@@GOLANGCI/TOGGLE",
}

export const toggle = (name: string, value?: boolean) => ({
  type: ToggleAction.Toggle,
  name,
  value,
});

interface IStore {
  [name: string]: boolean
};

export interface IToggleStore {
  store: IStore;
}

const store = (state: IStore = {}, action: any): IStore => {
  switch (action.type) {
    case ToggleAction.Toggle:
      let name: string = action.name;
      let newValue: boolean = action.value === undefined ? !state[name] : action.value;
      return Object.assign({}, state, {[name]: newValue});
    default:
      return state;
  }
}

export const toggleReducer = combineReducers<IToggleStore>({
  store,
})

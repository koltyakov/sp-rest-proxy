import { WebPartContext } from "@microsoft/sp-webpart-base";

export interface IHelloWorldProps {
  description: string;
  context: WebPartContext;
  isLocal: boolean;
}

export interface IHelloWorldState {
  lists: string[];
}

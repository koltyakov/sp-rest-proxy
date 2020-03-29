
export const generateGuid = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    // tslint:disable-next-line:no-bitwise
    const r = Math.random() * 16 | 0;
    // tslint:disable-next-line:no-bitwise
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const checkNestedProperties = (object: any, ...args: string[]): boolean => {
  args.forEach((arg) => {
    if (!object || !object.hasOwnProperty(arg)) {
      return false;
    }
    object = object[arg];
  });
  return true;
};

export const getCaseInsensitiveProp = (object: { [key: string]: any }, propertyName: string): any => {
  propertyName = propertyName.toLowerCase();
  return Object.keys(object).reduce((res: any, prop: string) => {
    if (prop.toLowerCase() === propertyName) {
      res = object[prop];
    }
    return res;
  }, undefined);
};

export const trimMultiline = (multiline: string): string => {
  return multiline.trim().split('\n').map((line) => line.trim()).join('\n');
};

export const enum LogLevel {
  Verbose = 5,
  Debug = 4,
  Info = 3,
  Warning = 2,
  Error = 1,
  Off = 0
}

export class Logger {

  constructor(public level: LogLevel | number = LogLevel.Info) { /**/ }

  public debug(...args: unknown[]): void {
    if (this.level >= LogLevel.Debug) {
      // tslint:disable-next-line:no-console
      console.log(...args);
    }
  }

  public verbose(...args: unknown[]): void {
    if (this.level >= LogLevel.Verbose) {
      // tslint:disable-next-line:no-console
      console.log(...args);
    }
  }

  public info(...args: unknown[]): void {
    if (this.level >= LogLevel.Info) {
      // tslint:disable-next-line:no-console
      console.log(...args);
    }
  }

  public warning(...args: unknown[]): void {
    if (this.level >= LogLevel.Warning) {
      // tslint:disable-next-line:no-console
      console.log(...args);
    }
  }

  public error(...args: unknown[]): void {
    if (this.level >= LogLevel.Error) {
      // tslint:disable-next-line:no-console
      console.log(...args);
    }
  }

}

export const logger = new Logger(parseInt(process.env.LOG_LEVEL || '3', 10));

const storage: {
  [key: string]: {
    expires: Date;
    value: string;
  };
} = {};

export class cache {

  public static set(key: string, value: string, ttl: number): void {
    const expires = new Date();
    expires.setMilliseconds(expires.getMilliseconds() + ttl);
    storage[key] = { value, expires };
  }

  public static get(key: string): string | null {
    const s = storage[key];
    if (!s) {
      return null;
    }
    if (s.expires < new Date()) {
      delete storage[key];
      return null;
    }
    return s.value;
  }

}
import { Response } from 'express';
import { Headers } from 'node-fetch';
import { IncomingHttpHeaders } from 'http';

export const mergeHeaders = (...headers: Headers[]): Headers => {
  const res = new Headers();
  for (const hh of headers) {
    if (hh) {
      hh.forEach((val, key) => {
        if (val) {
          res.set(key, val);
        } else {
          res.delete(key);
        }
      });
    }
  }
  return res;
};

export const getHeader = (headers: IncomingHttpHeaders, header: string): string | null => {
  let res: string = null;
  Object.keys(headers).forEach((key) => {
    if (key.toLowerCase() === header.toLowerCase()) {
      const val = headers[key];
      if (typeof val === 'string') {
        res = val;
      } else {
        res = val[0];
      }
    }
  });
  return res;
};

export const copyHeaders = (resp: Response, headers: Headers, copy: string[] = [], ignore: string[] = []): void => {
  copy = copy.map((k) => k.toLowerCase());
  ignore = ignore.map((k) => k.toLowerCase());
  headers.forEach((val, key) => {
    if (ignore.indexOf(key.toLowerCase()) === -1) {
      if (copy.length === 0 || copy.indexOf(key.toLowerCase()) !== -1) {
        resp.setHeader(key, val);
      }
    }
  });
};

export const getHeaders = (reqHeaders: IncomingHttpHeaders, ignoreHeaders: string[] = []): Headers => {
  const headers = new Headers();
  const ignoreDefaults = [ 'host', 'referer', 'origin' ];
  ignoreHeaders = [ ...ignoreHeaders.map((h) => h.toLowerCase()), ...ignoreDefaults ];
  Object.keys(reqHeaders).forEach((prop) => {
    if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
      headers.set(prop, getHeader(reqHeaders, prop));
    }
  });
  return headers;
};

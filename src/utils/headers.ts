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

export const copyHeaders = (resp: Response, headers: Headers, copy: string[]): void => {
  copy = copy.map((k) => k.toLowerCase());
  headers.forEach((val, key) => {
    if (copy.indexOf(key.toLowerCase()) !== -1) {
      resp.setHeader(key, val);
    }
  });
};

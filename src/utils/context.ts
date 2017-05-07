const prompt = require('prompt');
import * as fs from 'fs';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import * as Promise from 'bluebird';
import * as Cpass from 'cpass';

import { ProxyUtils } from '../utils';
import { IProxyContext, IProxySettings } from '../interfaces';
import { Request, Response, NextFunction } from 'express';

const cpass = new Cpass();

export class Context {

    private settings: IProxySettings;
    private ctx: any;

    constructor(settings: IProxySettings) {
        this.settings = settings;
    }

    public ctxFormat = (context: any): IProxyContext => {
        let formattedCtx: IProxyContext = {
            siteUrl: context.siteUrl || '',
            context: {
                ...context,
                siteUrl: undefined
            }
        };
        return formattedCtx;
    }

    public get = (): Promise<any> => {
        console.log('Config path: ' + this.settings.configPath);
        return new Promise((resolve: any, reject: any) => {
            fs.exists(this.settings.configPath, (exists: boolean) => {
                let needPrompts = !exists;
                if (exists) {
                    this.ctx = require(this.settings.configPath);
                    if (typeof this.ctx.password !== 'undefined') {
                        this.ctx.password = cpass.decode(this.ctx.password);
                    }
                    if (this.ctx.password === '' || typeof this.ctx.password === 'undefined') {
                        needPrompts = true;
                        if (typeof this.ctx.clientId !== 'undefined' && typeof this.ctx.clientSecret !== 'undefined') {
                            needPrompts = false;
                        }
                    }
                    if (!needPrompts) {
                        resolve(this.ctxFormat(this.ctx));
                    }
                }
                if (needPrompts) {
                    // Todo - move prompts with all possible auth scenarious into different library
                    let promptFor = [];
                    promptFor.push({
                        description: 'SharePoint Site Url',
                        name: 'siteUrl',
                        type: 'string',
                        required: true
                    });
                    promptFor.push({
                        description: 'Domain (for On-Prem only)',
                        name: 'domain',
                        type: 'string',
                        required: false
                    });
                    promptFor.push({
                        description: 'User login',
                        name: 'username',
                        type: 'string',
                        required: true
                    });
                    promptFor.push({
                        description: 'Password',
                        name: 'password',
                        type: 'string',
                        hidden: true,
                        replace: '*',
                        required: true
                    });
                    promptFor.push({
                        description: 'Do you want to save config to disk?',
                        name: 'save',
                        type: 'boolean',
                        default: true,
                        required: true
                    });
                    prompt.start();
                    prompt.get(promptFor, (err, res) => {
                        if (err) {
                            console.log(err);
                            return reject(err);
                        }
                        let json: any = {};
                        json.siteUrl = res.siteUrl;
                        json.username = res.username;
                        json.password = cpass.encode(res.password);
                        if (res.domain.length > 0) {
                            json.domain = res.domain;
                        }
                        this.ctx = {
                            ...json
                        };
                        if (res.save) {
                            let saveFolderPath = path.dirname(this.settings.configPath);
                            mkdirp(saveFolderPath, function (err) {
                                if (err) {
                                    console.log('Error creating folder ' + '`' + saveFolderPath + ' `', err);
                                };
                                fs.writeFile(this.settings.configPath, JSON.stringify(json, null, 2), 'utf8', (err) => {
                                    if (err) {
                                        console.log(err);
                                        return reject(err);
                                    }
                                    console.log('Config file is saved to ' + this.settings.configPath);
                                });
                                console.log('Please check readme for additional auth methods: https://github.com/koltyakov/sp-rest-proxy');
                            });
                        }
                        if (typeof this.ctx.password !== 'undefined') {
                            this.ctx.password = cpass.decode(this.ctx.password);
                        }
                        resolve(this.ctxFormat(this.ctx));
                    });
                }
            });
        });
    }
}

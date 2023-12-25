import { AosClient, PostRequestType, RequestType } from "../model/client";
import http, { Agent } from "http";
import { Readable } from "stream";
import https from "https";
import { stringify } from "querystring";
import filesize from "filesize";
import { HttpsProxyAgent, HttpProxyAgent } from "hpagent";
import dns from 'dns';
import { TunnelInfo } from "../model/ItunnelInfo";
import { EventEmitter } from 'events';
import { ILogger } from "../model/ILogger";
export class HttpClientWrapper extends EventEmitter implements AosClient {
    ref: string;
    client: http.ClientRequest | undefined;
    _responseController: http.IncomingMessage | undefined;
    timeout: number;
    refId: string | undefined;
    logger?: ILogger;
    timeoutHandler: any;
    constructor(ref: string, timeout = 20, logger?: ILogger) {
        super();
        this.ref = ref;
        this.logger = logger;
        this.timeout = timeout * 1000;
    }
    handleConnectAndDataTransferTimeout(url: string, reqId: string, refId: string) {
        if (this.timeout > 0) {
            this.timeoutHandler = setTimeout(() => {
                this.timeoutHandler = null;
                this.logger?.info("Http Request Timeout", { url, reqId, refId })
                this.client?.destroy(new Error("Http Request Timeout"));
            }, this.timeout);
        }
    }
    clearTimeoutHandler() {
        //console.error('clear timeout..', from, new Date().toUTCString());
        clearTimeout(this.timeoutHandler);
    }
    replaceHostname(url: string, newUrlWithHost: string): [string, string] {
        try {
            const parsedUrl = new URL(url);
            const originalHostnameWithProtocol = `${parsedUrl.protocol}//${parsedUrl.host}`;
            const newParsedUrl = new URL(newUrlWithHost);

            parsedUrl.protocol = newParsedUrl.protocol;
            parsedUrl.host = newParsedUrl.host;

            return [parsedUrl.toString(), originalHostnameWithProtocol];
        } catch (e) {
            throw new Error('Invalid URL');
        }
    }
    head<T>(url: string, headers: { [key: string]: string; }, reqType: RequestType, tunnelInfo: TunnelInfo, refId?: string | undefined, reqId?: string | undefined): Promise<{ statusCode: number; data: T; headers: { [key: string]: string; }; totalTime?: number | undefined; lastUrl?: string | undefined; length?: number | undefined; }> {
        this.logger?.info("Curl Request", { refId, url, headers, tunnelInfo, reqId });
        this.refId = refId;
        let agent: any = undefined;
        let dnsLookUp: any = undefined;
        const urlObj = new URL(url);

        //delete undefined headers key
        for (const key in headers) {
            if (!headers[key]) {
                delete headers[key];
            }
        }
        if (tunnelInfo.proxy && !tunnelInfo.dns) {
            const fnAgent = url.startsWith("https:")
                ? HttpsProxyAgent
                : HttpProxyAgent;
            agent = new fnAgent({
                keepAlive: true,
                keepAliveMsecs: 1000,
                proxy: tunnelInfo.proxy,
                //maxSockets: 5,
                timeout: 20000,
            });
        }
        if (tunnelInfo.dns && tunnelInfo.dns.length) {
            dnsLookUp = (hostname: string, options: any, callback: any) => {
                const resolver = new dns.Resolver();
                resolver.setServers([tunnelInfo.dns as string]);
                resolver.resolve4(hostname, (err, addresses) => {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, addresses[0], 4);
                    }
                });
            }
        }

        if (tunnelInfo.dnsAuto) {
            dnsLookUp = (hostname: string, options: any, callback: any) => {
                callback(null, tunnelInfo.dnsAuto, 4);
            }
        }

        const context = this;
        return new Promise((resolve, reject) => {
            function followRedirect(followUrl: string, maxTry: number) {
                if (maxTry >= 5) {
                    reject("Maximum times trying follow url error");
                }
                let targetUrl = followUrl;
                if (tunnelInfo.cdnProxy) {
                    const replaceResults = context.replaceHostname(targetUrl, tunnelInfo.cdnProxy);
                    targetUrl = replaceResults[0];
                    headers['targethost'] = replaceResults[1];
                }
                const newUrlObj = new URL(targetUrl);
                const options: any = {
                    method: "HEAD",
                    headers,
                    insecureHTTPParser: false,
                    agent,
                    lookup: dnsLookUp && urlObj.hostname === newUrlObj.hostname ? dnsLookUp : undefined,
                    localAddress: tunnelInfo.localIp
                };
                const fn = targetUrl.startsWith("https:")
                    ? https.request
                    : http.request;
                options.path = targetUrl;
                let startTime = Date.now();
                const client = fn(
                    targetUrl,
                    options as http.ClientRequestArgs,
                    async (clientResponse) => {
                        context._responseController = clientResponse;
                        if (
                            (clientResponse.statusCode as number) >= 300 &&
                            (clientResponse.statusCode as number) < 400 &&
                            clientResponse.headers.location
                        ) {
                            const newUrl = context.makeUrl(followUrl, clientResponse.headers.location);
                            followRedirect(newUrl, maxTry + 1);
                            return;
                        }
                        if (reqType === RequestType.RAW) {
                            const data: Buffer[] = [];

                            clientResponse
                                .on("data", function (chunk) {
                                    data.push(chunk);
                                })
                                .on("end", function () {
                                    let length = parseInt(
                                        clientResponse.headers["content-length"] || "0"
                                    );
                                    const contentLen = filesize(length);
                                    const totalTime = (Date.now() - startTime) / 1000;

                                    var buffer = Buffer.concat(data);

                                    context.logger?.info("Curl Response", {
                                        url,
                                        type: "stream",
                                        refId,
                                        statusCode: clientResponse.statusCode,
                                        reqId,
                                        totalTime,
                                        contentLen,
                                        receivedFileSizeContent: filesize(buffer.length),
                                        sameContent:
                                            filesize(buffer.length) === contentLen ? 1 : -1,
                                        errorContent:
                                            (clientResponse.statusCode as number) >= 400
                                                ? buffer.toString("utf-8")
                                                : "",
                                    });
                                    if ((clientResponse.statusCode as number) >= 400) {
                                        reject(`status code error : ${clientResponse.statusCode}`);
                                        return;
                                    }

                                    resolve({
                                        data: buffer as any,
                                        headers: clientResponse.headers as any,
                                        statusCode: clientResponse.statusCode as number,
                                        lastUrl: followUrl,
                                    });
                                })
                                .on("error", (err) => {
                                    context.killOrAbort(url, reqId, err.message);
                                    reject(`Error on read stream data : ${err.message}`);
                                });
                        } else if (reqType === RequestType.Stream) {
                            let length = parseInt(
                                clientResponse.headers["content-length"] || "0"
                            );
                            const contentLen = filesize(length);
                            const totalTime = (Date.now() - startTime) / 1000;
                            context.emit("http status", { refId, statusCode: clientResponse?.statusCode || -1, contentType: clientResponse?.headers['Content-Type'] as string || clientResponse?.headers['content-type'] as string })
                            context.logger?.info("Curl Response", {
                                url,
                                type: "stream",
                                refId,
                                statusCode: clientResponse.statusCode,
                                reqId,
                                totalTime,
                            });
                            if ((clientResponse.statusCode as number) >= 400) {
                                reject(`status code error : ${clientResponse.statusCode}`);
                                return;
                            }

                            resolve({
                                data: clientResponse as any,
                                headers: clientResponse.headers as any,
                                statusCode: clientResponse.statusCode as number,
                                lastUrl: followUrl,
                            });
                        } else {
                            const data: Buffer[] = [];

                            clientResponse
                                .on("data", function (chunk) {
                                    data.push(chunk);
                                })
                                .on("end", function () {
                                    var buffer = Buffer.concat(data);
                                    const output = buffer.toString("utf8");

                                    let length = parseInt(
                                        clientResponse.headers["content-length"] || "0"
                                    );
                                    const contentLen = filesize(length);
                                    const totalTime = (Date.now() - startTime) / 1000;
                                    context.logger?.info("Curl Response", {
                                        url,
                                        type: "stream",
                                        refId,
                                        statusCode: clientResponse.statusCode,
                                        reqId,
                                        totalTime,
                                        contentLen,
                                        proxyerrorContent:
                                            (clientResponse.statusCode as number) >= 400
                                                ? output
                                                : "",
                                    });
                                    if ((clientResponse.statusCode as number) >= 400) {
                                        reject(`status code error : ${clientResponse.statusCode}`);
                                        return;
                                    }

                                    resolve({
                                        data: output as any,
                                        headers: clientResponse.headers as any,
                                        statusCode: clientResponse.statusCode as number,
                                        lastUrl: followUrl,
                                    });
                                })
                                .on("error", (err) => {
                                    context.killOrAbort(url, reqId, err.message);
                                    reject(`Error on read stream data : ${err.message}`);
                                });
                        }
                    }
                );
                client.on("error", (err: any) => {
                    context.killOrAbort(url, reqId, err.message);
                    reject(err.message);
                });
                if (context.timeout > 0) {
                    client.setTimeout(context.timeout, () => {
                        context.killOrAbort(url, reqId, "Connection timed out");
                        reject("Connection timed out");
                    });
                }

                /* client.on('timeout', () => {
                            context.killOrAbort("Connection timed out " + context.timeout);
                        }); */

                client.on("error", (err: any) => {
                    reject(err);
                });
                client.end();
                context.client = client;
            }
            followRedirect(url, 0);
        });
    }
    put<T>(url: string, headers: { [key: string]: string; }, reqType: RequestType, postRequestType: PostRequestType, data: { [key: string]: any; }, tunnelInfo: TunnelInfo, refId?: string | undefined, reqId?: string | undefined): Promise<{ statusCode: number; data: T; headers: { [key: string]: string; }; totalTime?: number | undefined; lastUrl?: string | undefined; length?: number | undefined; }> {
        this.logger?.info("Curl Request", { refId, url, headers, tunnelInfo, reqId });
        this.refId = refId;

        if (postRequestType === PostRequestType.JSON) {
            headers["Content-Type"] = "application/json";
            data = JSON.stringify(data) as any;
        } else {
            headers["Content-Type"] = "application/x-www-form-urlencoded";
            data = stringify(data) as any;
        }
        //delete undefined headers key
        for (const key in headers) {
            if (!headers[key]) {
                delete headers[key];
            }
        }

        let agent: any;
        let dnsLookUp: any = undefined;
        const urlObj = new URL(url);
        if (tunnelInfo.proxy && !tunnelInfo.dns) {
            const fnAgent = url.startsWith("https:")
                ? HttpsProxyAgent
                : HttpProxyAgent;
            agent = new fnAgent({
                keepAlive: true,
                keepAliveMsecs: 1000,
                proxy: tunnelInfo.proxy,
                //maxSockets: 5,
                timeout: 20000,
            });
        }

        if (tunnelInfo.dns && tunnelInfo.dns.length) {
            dnsLookUp = (hostname: string, options: any, callback: any) => {
                const resolver = new dns.Resolver();
                resolver.setServers([tunnelInfo.dns as string]);
                resolver.resolve4(hostname, (err, addresses) => {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, addresses[0], 4);
                    }
                });
            }
        }

        if (tunnelInfo.dnsAuto) {
            dnsLookUp = (hostname: string, options: any, callback: any) => {
                callback(null, tunnelInfo.dnsAuto, 4);
            }
        }


        const context = this;
        return new Promise((resolve, reject) => {
            function followRedirect(followUrl: string, maxTry: number) {
                if (maxTry >= 5) {
                    reject("Maximum times trying follow url error");
                }
                let targetUrl = followUrl;
                if (tunnelInfo.cdnProxy) {
                    const replaceResults = context.replaceHostname(targetUrl, tunnelInfo.cdnProxy);
                    targetUrl = replaceResults[0];
                    headers['targethost'] = replaceResults[1];
                }
                const newUrlObj = new URL(targetUrl);
                const options: any = {
                    method: "PUT",
                    headers,
                    insecureHTTPParser: false,
                    agent,
                    lookup: dnsLookUp && urlObj.hostname === newUrlObj.hostname ? dnsLookUp : undefined,
                    localAddress: tunnelInfo.localIp
                };

                const fn = targetUrl.startsWith("https:") ? https.request : http.request;
                options.path = targetUrl;

                let startTime = Date.now();
                const client = fn(
                    targetUrl,
                    options as http.ClientRequestArgs,
                    async (clientResponse) => {
                        context._responseController = clientResponse;
                        if (
                            (clientResponse.statusCode as number) >= 300 &&
                            (clientResponse.statusCode as number) < 400 &&
                            clientResponse.headers.location
                        ) {
                            const newUrl = context.makeUrl(followUrl, clientResponse.headers.location);
                            followRedirect(newUrl, maxTry + 1);
                            return;
                        }
                        if (reqType === RequestType.RAW) {
                            const data: Buffer[] = [];

                            clientResponse
                                .on("data", function (chunk) {
                                    data.push(chunk);
                                })
                                .on("end", function () {
                                    var buffer = Buffer.concat(data);

                                    let length = parseInt(
                                        clientResponse.headers["content-length"] || "0"
                                    );
                                    const contentLen = filesize(length);
                                    const totalTime = (Date.now() - startTime) / 1000;
                                    context.logger?.info("Curl Response", {
                                        url,
                                        type: "stream",
                                        refId,
                                        statusCode: clientResponse.statusCode,
                                        reqId,
                                        totalTime,
                                        contentLen,
                                        tunnelInfo,
                                        errorContent:
                                            (clientResponse.statusCode as number) >= 400
                                                ? buffer.toString("utf-8")
                                                : "",
                                    });
                                    if ((clientResponse.statusCode as number) >= 400) {
                                        reject(`status code error : ${clientResponse.statusCode}`);
                                        return;
                                    }

                                    resolve({
                                        data: buffer as any,
                                        headers: clientResponse.headers as any,
                                        statusCode: clientResponse.statusCode as number,
                                        lastUrl: followUrl,
                                    });
                                })
                                .on("error", (err) => {
                                    context.killOrAbort(url, reqId, err.message);
                                    reject(`Error on read stream data : ${err.message}`);
                                });
                        } else if (reqType === RequestType.Stream) {
                            let length = parseInt(
                                clientResponse.headers["content-length"] || "0"
                            );
                            const contentLen = filesize(length);
                            const totalTime = (Date.now() - startTime) / 1000;
                            context.logger?.info("Curl Response", {
                                url,
                                type: "stream",
                                refId,
                                statusCode: clientResponse.statusCode,
                                reqId,
                                totalTime,
                                contentLen,
                                tunnelInfo,
                            });

                            if ((clientResponse.statusCode as number) >= 400) {
                                reject(`status code error : ${clientResponse.statusCode}`);
                                return;
                            }

                            resolve({
                                data: clientResponse as any,
                                headers: clientResponse.headers as any,
                                statusCode: clientResponse.statusCode as number,
                                lastUrl: followUrl,
                            });
                        } else {
                            const data: Buffer[] = [];

                            clientResponse
                                .on("data", function (chunk) {
                                    data.push(chunk);
                                })
                                .on("end", function () {
                                    var buffer = Buffer.concat(data);
                                    const output = buffer.toString("utf8");

                                    let length = parseInt(
                                        clientResponse.headers["content-length"] || "0"
                                    );
                                    const contentLen = filesize(length);
                                    const totalTime = (Date.now() - startTime) / 1000;
                                    context.logger?.info("Curl Response", {
                                        url,
                                        type: "stream",
                                        refId,
                                        statusCode: clientResponse.statusCode,
                                        reqId,
                                        totalTime,
                                        contentLen,
                                        tunnelInfo,
                                        errorContent:
                                            (clientResponse.statusCode as number) >= 400
                                                ? output
                                                : "",
                                    });
                                    if ((clientResponse.statusCode as number) >= 400) {
                                        reject(`status code error : ${clientResponse.statusCode}`);
                                        return;
                                    }

                                    resolve({
                                        data: output as any,
                                        headers: clientResponse.headers as any,
                                        statusCode: clientResponse.statusCode as number,
                                        lastUrl: followUrl,
                                    });
                                })
                                .on("error", (err) => {
                                    context.killOrAbort(url, reqId, err.message);
                                    reject(`Error on read stream data : ${err.message}`);
                                });
                        }
                    }
                );
                client.on("error", (err: any) => {
                    context.killOrAbort(url, reqId, err.message);
                    reject(err.message);
                });
                client.write(data);
                client.end();
                if (context.timeout > 0) {
                    client.setTimeout(context.timeout, () => {
                        context.killOrAbort(url, reqId, "Connection timed out");
                        reject("Connection timed out");
                    });
                }
                // client.on('timeout', () => {
                //     context.killOrAbort("Connection timed out");
                // });
                context.client = client;
            }
            followRedirect(url, 0);
        });
    }
    delete<T>(url: string, headers: { [key: string]: string; }, reqType: RequestType, postRequestType: PostRequestType, data: { [key: string]: any; } | undefined, tunnelInfo: TunnelInfo, refId?: string | undefined, reqId?: string | undefined): Promise<{ statusCode: number; data: T; headers: { [key: string]: string; }; totalTime?: number | undefined; lastUrl?: string | undefined; length?: number | undefined; }> {
        this.logger?.info("Curl Request", { refId, url, headers, tunnelInfo, reqId });
        this.refId = refId;

        if (postRequestType === PostRequestType.JSON) {
            headers["Content-Type"] = "application/json";
            data = JSON.stringify(data) as any;
        } else {
            headers["Content-Type"] = "application/x-www-form-urlencoded";
            data = stringify(data) as any;
        }
        //delete undefined headers key
        for (const key in headers) {
            if (!headers[key]) {
                delete headers[key];
            }
        }
        let agent: any;
        let dnsLookUp: any = undefined;
        const urlObj = new URL(url);
        if (tunnelInfo.proxy && !tunnelInfo.dns) {
            const fnAgent = url.startsWith("https:")
                ? HttpsProxyAgent
                : HttpProxyAgent;
            agent = new fnAgent({
                keepAlive: true,
                keepAliveMsecs: 1000,
                proxy: tunnelInfo.proxy,
                //maxSockets: 5,
                timeout: 20000,
            });
        }

        if (tunnelInfo.dns && tunnelInfo.dns.length) {
            dnsLookUp = (hostname: string, options: any, callback: any) => {
                const resolver = new dns.Resolver();
                resolver.setServers([tunnelInfo.dns as string]);
                resolver.resolve4(hostname, (err, addresses) => {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, addresses[0], 4);
                    }
                });
            }
        }

        if (tunnelInfo.dnsAuto) {
            dnsLookUp = (hostname: string, options: any, callback: any) => {
                callback(null, tunnelInfo.dnsAuto, 4);
            }
        }


        const context = this;
        return new Promise((resolve, reject) => {
            function followRedirect(followUrl: string, maxTry: number) {
                if (maxTry >= 5) {
                    reject("Maximum times trying follow url error");
                }
                let targetUrl = followUrl;
                if (tunnelInfo.cdnProxy) {
                    const replaceResults = context.replaceHostname(targetUrl, tunnelInfo.cdnProxy);
                    targetUrl = replaceResults[0];
                    headers['targethost'] = replaceResults[1];
                }
                const newUrlObj = new URL(targetUrl);
                const options: any = {
                    method: "DELETE",
                    headers,
                    insecureHTTPParser: false,
                    agent,
                    lookup: dnsLookUp && urlObj.hostname === newUrlObj.hostname ? dnsLookUp : undefined,
                    localAddress: tunnelInfo.localIp
                };
                const fn = targetUrl.startsWith("https:") ? https.request : http.request;
                options.path = targetUrl;
                let startTime = Date.now();
                const client = fn(
                    targetUrl,
                    options as http.ClientRequestArgs,
                    async (clientResponse) => {
                        context._responseController = clientResponse;
                        if (
                            (clientResponse.statusCode as number) >= 300 &&
                            (clientResponse.statusCode as number) < 400 &&
                            clientResponse.headers.location
                        ) {
                            const newUrl = context.makeUrl(followUrl, clientResponse.headers.location);
                            followRedirect(newUrl, maxTry + 1);
                            return;
                        }
                        if (reqType === RequestType.RAW) {
                            const data: Buffer[] = [];

                            clientResponse
                                .on("data", function (chunk) {
                                    data.push(chunk);
                                })
                                .on("end", function () {
                                    var buffer = Buffer.concat(data);

                                    let length = parseInt(
                                        clientResponse.headers["content-length"] || "0"
                                    );
                                    const contentLen = filesize(length);
                                    const totalTime = (Date.now() - startTime) / 1000;
                                    context.logger?.info("Curl Response", {
                                        url,
                                        type: "stream",
                                        refId,
                                        statusCode: clientResponse.statusCode,
                                        reqId,
                                        totalTime,
                                        contentLen,
                                        tunnelInfo,
                                        errorContent:
                                            (clientResponse.statusCode as number) >= 400
                                                ? buffer.toString("utf-8")
                                                : "",
                                    });
                                    if ((clientResponse.statusCode as number) >= 400) {
                                        reject(`status code error : ${clientResponse.statusCode}`);
                                        return;
                                    }

                                    resolve({
                                        data: buffer as any,
                                        headers: clientResponse.headers as any,
                                        statusCode: clientResponse.statusCode as number,
                                        lastUrl: followUrl,
                                    });
                                })
                                .on("error", (err) => {
                                    context.killOrAbort(url, reqId, err.message);
                                    reject(`Error on read stream data : ${err.message}`);
                                });
                        } else if (reqType === RequestType.Stream) {
                            let length = parseInt(
                                clientResponse.headers["content-length"] || "0"
                            );
                            const contentLen = filesize(length);
                            const totalTime = (Date.now() - startTime) / 1000;
                            context.logger?.info("Curl Response", {
                                url,
                                type: "stream",
                                refId,
                                statusCode: clientResponse.statusCode,
                                reqId,
                                totalTime,
                                contentLen,
                                tunnelInfo,
                            });

                            if ((clientResponse.statusCode as number) >= 400) {
                                reject(`status code error : ${clientResponse.statusCode}`);
                                return;
                            }

                            resolve({
                                data: clientResponse as any,
                                headers: clientResponse.headers as any,
                                statusCode: clientResponse.statusCode as number,
                                lastUrl: followUrl,
                            });
                        } else {
                            const data: Buffer[] = [];

                            clientResponse
                                .on("data", function (chunk) {
                                    data.push(chunk);
                                })
                                .on("end", function () {
                                    var buffer = Buffer.concat(data);
                                    const output = buffer.toString("utf8");

                                    let length = parseInt(
                                        clientResponse.headers["content-length"] || "0"
                                    );
                                    const contentLen = filesize(length);
                                    const totalTime = (Date.now() - startTime) / 1000;
                                    context.logger?.info("Curl Response", {
                                        url,
                                        type: "stream",
                                        refId,
                                        statusCode: clientResponse.statusCode,
                                        reqId,
                                        totalTime,
                                        contentLen,
                                        tunnelInfo,
                                        errorContent:
                                            (clientResponse.statusCode as number) >= 400
                                                ? output
                                                : "",
                                    });
                                    if ((clientResponse.statusCode as number) >= 400) {
                                        reject(`status code error : ${clientResponse.statusCode}`);
                                        return;
                                    }

                                    resolve({
                                        data: output as any,
                                        headers: clientResponse.headers as any,
                                        statusCode: clientResponse.statusCode as number,
                                        lastUrl: followUrl,
                                    });
                                })
                                .on("error", (err) => {
                                    context.killOrAbort(url, reqId, err.message);
                                    reject(`Error on read stream data : ${err.message}`);
                                });
                        }
                    }
                );
                client.on("error", (err: any) => {
                    context.killOrAbort(url, reqId, err.message);
                    reject(err.message);
                });
                client.write(data);
                client.end();
                if (context.timeout > 0) {
                    client.setTimeout(context.timeout, () => {
                        context.killOrAbort(url, reqId, "Connection timed out");
                        reject("Connection timed out");
                    });
                }
                // client.on('timeout', () => {
                //     context.killOrAbort("Connection timed out");
                // });
                context.client = client;
            }
            followRedirect(url, 0);
        });
    }
    makeUrl(baseURL: string, newURL: string) {
        const base_urls = {
            "relative": baseURL.replace(/[\?#].*$/, '').replace(/[^\/]+$/, ''),
            "absolute": baseURL.replace(/(:\/\/[^\/]+).*$/, '$1')
        }
        if (newURL.startsWith("http")) {
            return newURL;
        }
        if (newURL.startsWith("/")) {
            return base_urls.absolute + newURL;
        }
        return base_urls.relative + newURL;
    }
    get<T>(
        url: string,
        headers: {
            [key: string]: string;
        },
        reqType: RequestType,
        tunnelInfo: TunnelInfo,
        refId?: string,
        reqId?: string
    ): Promise<{
        statusCode: number;
        data: T;
        headers: { [key: string]: string };
        totalTime?: number | undefined;
        lastUrl?: string | undefined;
        length?: number | undefined;
    }> {
        this.logger?.info("Curl Request", { refId, url, headers, tunnelInfo, reqId });
        this.refId = refId;
        let agent: any = undefined;
        let dnsLookUp: any = undefined;
        const urlObj = new URL(url);

        //delete undefined headers key
        for (const key in headers) {
            if (!headers[key]) {
                delete headers[key];
            }
        }
        if (tunnelInfo.proxy && !tunnelInfo.dns) {
            const fnAgent = url.startsWith("https:")
                ? HttpsProxyAgent
                : HttpProxyAgent;
            agent = new fnAgent({
                keepAlive: true,
                keepAliveMsecs: 1000,
                proxy: tunnelInfo.proxy,
                //maxSockets: 5,
                timeout: 20000,
            });
        }
        if (tunnelInfo.dns && tunnelInfo.dns.length) {
            dnsLookUp = (hostname: string, options: any, callback: any) => {
                const resolver = new dns.Resolver();
                resolver.setServers([tunnelInfo.dns as string]);
                resolver.resolve4(hostname, (err, addresses) => {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, addresses[0], 4);
                    }
                });
            }
        }
        if (tunnelInfo.dnsAuto) {
            dnsLookUp = (hostname: string, options: any, callback: any) => {
                callback(null, tunnelInfo.dnsAuto, 4);
            }
        }

        const context = this;
        return new Promise((resolve, reject) => {
            function followRedirect(followUrl: string, maxTry: number) {
                try {
                    if (maxTry >= 5) {
                        context.clearTimeoutHandler();
                        return reject("Maximum times trying follow url error");
                    }

                    let targetUrl = followUrl;
                    if (tunnelInfo.cdnProxy) {
                        const replaceResults = context.replaceHostname(targetUrl, tunnelInfo.cdnProxy);
                        targetUrl = replaceResults[0];
                        headers['targethost'] = replaceResults[1];
                    }
                    const newUrlObj = new URL(targetUrl);
                    const options: any = {
                        headers,
                        insecureHTTPParser: false,
                        agent,
                        lookup: dnsLookUp && urlObj.hostname === newUrlObj.hostname ? dnsLookUp : undefined,
                        localAddress: tunnelInfo.localIp
                    };
                    const fn = targetUrl.startsWith("https:")
                        ? https.get
                        : http.get;
                    //options.path = targetUrl;
                    let startTime = Date.now();
                    const client = fn(
                        targetUrl,
                        options as http.ClientRequestArgs,
                        async (clientResponse) => {
                            context._responseController = clientResponse;
                            if (
                                (clientResponse.statusCode as number) >= 300 &&
                                (clientResponse.statusCode as number) < 400 &&
                                clientResponse.headers.location
                            ) {
                                context.clearTimeoutHandler();
                                const newUrl = context.makeUrl(followUrl, clientResponse.headers.location);
                                followRedirect(newUrl, maxTry + 1);
                                return;
                            }
                            clientResponse
                                .once("readable", function () {
                                    context.clearTimeoutHandler();
                                });
                            if (reqType === RequestType.RAW) {
                                const data: Buffer[] = [];
                                clientResponse
                                    .on("data", function (chunk) {
                                        data.push(chunk);
                                    }).on("end", function () {
                                        let length = parseInt(
                                            clientResponse.headers["content-length"] || "0"
                                        );
                                        const contentLen = filesize(length);
                                        const totalTime = (Date.now() - startTime) / 1000;

                                        var buffer = Buffer.concat(data);

                                        context.logger?.info("Curl Response", {
                                            url,
                                            type: "stream",
                                            refId,
                                            statusCode: clientResponse.statusCode,
                                            reqId,
                                            totalTime,
                                            contentLen,
                                            receivedFileSizeContent: filesize(buffer.length),
                                            sameContent:
                                                filesize(buffer.length) === contentLen ? 1 : -1,
                                            errorContent:
                                                (clientResponse.statusCode as number) >= 400
                                                    ? buffer.toString("utf-8")
                                                    : "",
                                        });
                                        if ((clientResponse.statusCode as number) >= 400) {
                                            reject(`status code error : ${clientResponse.statusCode}`);
                                            return;
                                        }

                                        resolve({
                                            data: buffer as any,
                                            headers: clientResponse.headers as any,
                                            statusCode: clientResponse.statusCode as number,
                                            lastUrl: followUrl,
                                        });
                                    })
                                    .on("error", (err) => {
                                        context.killOrAbort(url, reqId, err.message);
                                        reject(`Error on read stream data : ${err.message}`);
                                    });
                            } else if (reqType === RequestType.Stream) {
                                let length = parseInt(
                                    clientResponse.headers["content-length"] || "0"
                                );
                                const contentLen = filesize(length);
                                const totalTime = (Date.now() - startTime) / 1000;
                                context.emit("http status", { refId, statusCode: clientResponse?.statusCode || -1, contentType: clientResponse?.headers['Content-Type'] as string || clientResponse?.headers['content-type'] as string })
                                context.logger?.info("Curl Response", {
                                    url,
                                    type: "stream",
                                    refId,
                                    statusCode: clientResponse.statusCode,
                                    reqId,
                                    totalTime,
                                });
                                if ((clientResponse.statusCode as number) >= 400) {
                                    reject(`status code error : ${clientResponse.statusCode}`);
                                    return;
                                }

                                resolve({
                                    data: clientResponse as any,
                                    headers: clientResponse.headers as any,
                                    statusCode: clientResponse.statusCode as number,
                                    lastUrl: followUrl,
                                });
                            } else {
                                const data: Buffer[] = [];

                                clientResponse
                                    .on("data", function (chunk) {
                                        data.push(chunk);
                                    })
                                    .on("end", function () {
                                        var buffer = Buffer.concat(data);
                                        const output = buffer.toString("utf8");

                                        let length = parseInt(
                                            clientResponse.headers["content-length"] || "0"
                                        );
                                        const contentLen = filesize(length);
                                        const totalTime = (Date.now() - startTime) / 1000;
                                        context.logger?.info("Curl Response", {
                                            url,
                                            type: "stream",
                                            refId,
                                            statusCode: clientResponse.statusCode,
                                            reqId,
                                            totalTime,
                                            contentLen,
                                            proxyerrorContent:
                                                (clientResponse.statusCode as number) >= 400
                                                    ? output
                                                    : "",
                                        });
                                        if ((clientResponse.statusCode as number) >= 400) {
                                            reject(`status code error : ${clientResponse.statusCode}`);
                                            return;
                                        }

                                        resolve({
                                            data: output as any,
                                            headers: clientResponse.headers as any,
                                            statusCode: clientResponse.statusCode as number,
                                            lastUrl: followUrl,
                                        });
                                    })
                                    .on("error", (err) => {
                                        context.killOrAbort(url, reqId, err.message);
                                        reject(`Error on read stream data : ${err.message}`);
                                    });
                            }
                        }
                    );
                    client.on("error", (err: any) => {
                        context.killOrAbort(url, reqId, err.message);
                        reject(err.message);
                    });

                    client.on("close", (err: any) => {
                        context.clearTimeoutHandler();
                    });
                    client.end();
                    context.client = client;
                    context.handleConnectAndDataTransferTimeout(url, reqId || "", refId || "");
                } catch (error) {
                    context.clearTimeoutHandler();
                    context.logger?.info("Curl Catch Error", { refId, url, followUrl, headers, tunnelInfo, reqId });
                    reject(error);
                }
            }
            followRedirect(url, 0);
        });
    }
    post<T>(
        url: string,
        headers: {
            [key: string]: string;
        },
        reqType: RequestType,
        postRequestType: PostRequestType,
        data: {
            [key: string]: any;
        },
        tunnelInfo: TunnelInfo,
        refId?: string,
        reqId?: string
    ): Promise<{
        statusCode: number;
        data: T;
        headers: { [key: string]: string };
        totalTime?: number | undefined;
        lastUrl?: string | undefined;
        length?: number | undefined;
    }> {
        this.logger?.info("Curl Request", { refId, url, headers, tunnelInfo, reqId });
        this.refId = refId;

        if (postRequestType === PostRequestType.JSON) {
            data = JSON.stringify(data) as any;
            headers["Content-Type"] = "application/json";
            headers['Content-Length'] = data.length;
        } else {
            headers["Content-Type"] = "application/x-www-form-urlencoded";
            data = stringify(data) as any;
            headers['Content-Length'] = data.length;
        }

        //delete undefined headers key
        for (const key in headers) {
            if (!headers[key]) {
                delete headers[key];
            }
        }

        let agent: any;
        let dnsLookUp: any = undefined;
        const urlObj = new URL(url);
        if (tunnelInfo.proxy && !tunnelInfo.dns) {
            const fnAgent = url.startsWith("https:")
                ? HttpsProxyAgent
                : HttpProxyAgent;
            agent = new fnAgent({
                keepAlive: true,
                keepAliveMsecs: 1000,
                proxy: tunnelInfo.proxy,
                //maxSockets: 5,
                timeout: 20000,
            });
        }

        if (tunnelInfo.dns && tunnelInfo.dns.length) {
            dnsLookUp = (hostname: string, options: any, callback: any) => {
                const resolver = new dns.Resolver();
                resolver.setServers([tunnelInfo.dns as string]);
                resolver.resolve4(hostname, (err, addresses) => {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, addresses[0], 4);
                    }
                });
            }
        }

        if (tunnelInfo.dnsAuto) {
            dnsLookUp = (hostname: string, options: any, callback: any) => {
                callback(null, tunnelInfo.dnsAuto, 4);
            }
        }
        const context = this;
        return new Promise((resolve, reject) => {
            function followRedirect(followUrl: string, maxTry: number) {
                if (maxTry >= 5) {
                    return reject("Maximum times trying follow url error");
                }

                let targetUrl = followUrl;
                if (tunnelInfo.cdnProxy) {
                    const replaceResults = context.replaceHostname(targetUrl, tunnelInfo.cdnProxy);
                    targetUrl = replaceResults[0];
                    headers['targethost'] = replaceResults[1];
                }
                const newUrlObj = new URL(targetUrl);
                const options: any = {
                    method: "POST",
                    headers,
                    insecureHTTPParser: false,
                    agent,
                    lookup: dnsLookUp && urlObj.hostname === newUrlObj.hostname ? dnsLookUp : undefined,
                    localAddress: tunnelInfo.localIp
                };

                const fn = targetUrl.startsWith("https:") ? https.request : http.request;
                options.path = targetUrl;
                let startTime = Date.now();
                const client = fn(
                    targetUrl,
                    options as http.ClientRequestArgs,
                    async (clientResponse) => {
                        context._responseController = clientResponse;
                        if (
                            (clientResponse.statusCode as number) >= 300 &&
                            (clientResponse.statusCode as number) < 400 &&
                            clientResponse.headers.location
                        ) {
                            const newUrl = context.makeUrl(followUrl, clientResponse.headers.location);
                            followRedirect(newUrl, maxTry + 1);
                            return;
                        }
                        if (reqType === RequestType.RAW) {
                            const data: Buffer[] = [];

                            clientResponse
                                .on("data", function (chunk) {
                                    data.push(chunk);
                                })
                                .on("end", function () {
                                    var buffer = Buffer.concat(data);

                                    let length = parseInt(
                                        clientResponse.headers["content-length"] || "0"
                                    );
                                    const contentLen = filesize(length);
                                    const totalTime = (Date.now() - startTime) / 1000;
                                    context.logger?.info("Curl Response", {
                                        url,
                                        type: "stream",
                                        refId,
                                        statusCode: clientResponse.statusCode,
                                        reqId,
                                        totalTime,
                                        contentLen,
                                        tunnelInfo,
                                        errorContent:
                                            (clientResponse.statusCode as number) >= 400
                                                ? buffer.toString("utf-8")
                                                : "",
                                    });
                                    if ((clientResponse.statusCode as number) >= 400) {
                                        reject(`status code error : ${clientResponse.statusCode}`);
                                        return;
                                    }

                                    resolve({
                                        data: buffer as any,
                                        headers: clientResponse.headers as any,
                                        statusCode: clientResponse.statusCode as number,
                                        lastUrl: followUrl,
                                    });
                                })
                                .on("error", (err) => {
                                    context.killOrAbort(url, reqId, err.message);
                                    reject(`Error on read stream data : ${err.message}`);
                                });
                        } else if (reqType === RequestType.Stream) {
                            let length = parseInt(
                                clientResponse.headers["content-length"] || "0"
                            );
                            const contentLen = filesize(length);
                            const totalTime = (Date.now() - startTime) / 1000;
                            context.logger?.info("Curl Response", {
                                url,
                                type: "stream",
                                refId,
                                statusCode: clientResponse.statusCode,
                                reqId,
                                totalTime,
                                contentLen,
                                tunnelInfo,
                            });

                            if ((clientResponse.statusCode as number) >= 400) {
                                reject(`status code error : ${clientResponse.statusCode}`);
                                return;
                            }

                            resolve({
                                data: clientResponse as any,
                                headers: clientResponse.headers as any,
                                statusCode: clientResponse.statusCode as number,
                                lastUrl: followUrl,
                            });
                        } else {
                            const data: Buffer[] = [];

                            clientResponse
                                .on("data", function (chunk) {
                                    data.push(chunk);
                                })
                                .on("end", function () {
                                    var buffer = Buffer.concat(data);
                                    const output = buffer.toString("utf8");

                                    let length = parseInt(
                                        clientResponse.headers["content-length"] || "0"
                                    );
                                    const contentLen = filesize(length);
                                    const totalTime = (Date.now() - startTime) / 1000;
                                    context.logger?.info("Curl Response", {
                                        url,
                                        type: "stream",
                                        refId,
                                        statusCode: clientResponse.statusCode,
                                        reqId,
                                        totalTime,
                                        contentLen,
                                        tunnelInfo,
                                        errorContent:
                                            (clientResponse.statusCode as number) >= 400
                                                ? output
                                                : "",
                                    });
                                    if ((clientResponse.statusCode as number) >= 400) {
                                        reject(`status code error : ${clientResponse.statusCode}`);
                                        return;
                                    }

                                    resolve({
                                        data: output as any,
                                        headers: clientResponse.headers as any,
                                        statusCode: clientResponse.statusCode as number,
                                        lastUrl: followUrl,
                                    });
                                })
                                .on("error", (err) => {
                                    context.killOrAbort(url, reqId, err.message);
                                    reject(`Error on read stream data : ${err.message}`);
                                });
                        }
                    }
                );
                client.on("error", (err: any) => {
                    context.killOrAbort(url, reqId, err.message);
                    reject(err.message);
                });
                client.write(data);
                client.end();
                if (context.timeout > 0) {
                    client.setTimeout(context.timeout, () => {
                        context.killOrAbort(url, reqId, "Connection timed out");
                        reject("Connection timed out");
                    });
                }
                // client.on('timeout', () => {
                //     context.killOrAbort("Connection timed out");
                // });
                context.client = client;
            }
            followRedirect(url, 0);
        });
    }
    killOrAbort(url?: string, ref?: string, msg?: string): void {
        this.logger?.info("http request kill", { refId: this.refId, msg, url, ref });
        this.client?.destroy();
    }
    getClient() {
        return this.client;
    }
    getResponseController() {
        return this._responseController;
    }

}
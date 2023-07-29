import { TunnelInfo } from "./ItunnelInfo";


export interface AosClient {
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
    headers: {
      [key: string]: string;
    };
    totalTime?: number;
    lastUrl?: string;
    length?: number;
  }>;

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
    headers: {
      [key: string]: string;
    };
    totalTime?: number;
    lastUrl?: string;
    length?: number;
  }>;

  head<T>(
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
    headers: {
      [key: string]: string;
    };
    totalTime?: number;
    lastUrl?: string;
    length?: number;
  }>;

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
    headers: {
      [key: string]: string;
    };
    totalTime?: number;
    lastUrl?: string;
    length?: number;
  }>;

  put<T>(
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
    headers: {
      [key: string]: string;
    };
    totalTime?: number;
    lastUrl?: string;
    length?: number;
  }>;

  delete<T>(
    url: string,
    headers: {
      [key: string]: string;
    },
    reqType: RequestType,
    postRequestType: PostRequestType,
    data: {
      [key: string]: any;
    } | undefined,
    tunnelInfo: TunnelInfo,
    refId?: string,
    reqId?: string
  ): Promise<{
    statusCode: number;
    data: T;
    headers: {
      [key: string]: string;
    };
    totalTime?: number;
    lastUrl?: string;
    length?: number;
  }>;


  killOrAbort(url?: string, ref?: string, msg?: string): void;
}

export enum RequestType {
  RAW,
  Stream,
  String,
}

export enum PostRequestType {
  JSON = "JSON",
  URL_ENCODE = "URL_ENCODE",
}

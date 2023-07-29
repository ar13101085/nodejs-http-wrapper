export interface ILogger {
    info: (message: string, payload: { [key: string]: any }) => void;
    warn: (message: string, payload: { [key: string]: any }) => void;
    error: (message: string, payload: { [key: string]: any }) => void;
    debug: (message: string, payload: { [key: string]: any }) => void;
}
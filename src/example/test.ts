import { HttpClientWrapper } from "../http-client/HttpClientWrapper";
import { PostRequestType, RequestType } from "../model/client";
import { Readable } from "stream"

const _client = new HttpClientWrapper("", 0, console);
const url = new URL(`http://localhost:8090/live/arif/test/193313`);
_client.get<Readable>(`http://localhost:8090/live/arif/test/193313`, {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36",
    // "Connection": "keep-alive",
    // "Host": url.host
}, RequestType.String, {
    // cdnProxy: "http://ind.mrxtx.one:8080"
}).then(res => {
    console.log('res', res.headers);
}).catch(err => {
    console.log(err);
})

/* 
_client.put<string>("https://api.fubo.tv/signin", {
    //'accept-encoding': 'gzip',
    'accept-language': 'en-US',
    'connection': 'Keep-Alive',
    'content-type': 'application/json; charset=UTF-8',
    'user-agent': 'FuboTV/4.74.0 (Linux; U; android; en-US; samsung Model/SM-G935F OS/8.0.0)',
    'x-client-version': '4.74.0',
    'x-device-app': 'android',
    'x-device-group': 'mobile',
    'x-device-id': '2cbeea29-6f53-4e49-9b7d-ad2b96b4a536',
    'x-device-model': 'SM-G935F',
    'x-device-name': 'Galaxy S7 edge',
    'x-device-platform': 'android_phone',
    'x-device-type': 'phone',
    'x-player-version': 'v1.34.2',
    'x-preferred-language': 'en-US'
}, RequestType.String, PostRequestType.JSON, { "password": "Callie28", "username": "timothy.cacchione@gmail.com" }, {
    cdnProxy: "http://us1.mrxtx.one:8080"
}, 'getAuth', 'fubotv').then(res => {
    console.log('res', res);
})
 */

/**
 * {
1|aos-http-proxy-1  |   'user-agent': '4.9.0 brand-samsung model-SM-G935F os-8.0.0 sl-L3 dstv-now-android-2.5.4',
1|aos-http-proxy-1  |   'proxy-authorization': 'Basic c2Y4OjI3NDM=',
1|aos-http-proxy-1  |   'content-type': 'application/json',
1|aos-http-proxy-1  |   targethost: 'https://ssl.dstv.com',
1|aos-http-proxy-1  |   host: '139.84.232.206:3001',
1|aos-http-proxy-1  |   connection: 'close',
1|aos-http-proxy-1  |   'transfer-encoding': 'chunked'
1|aos-http-proxy-1  | }


{
    1|aos-http-proxy-1  |   'user-agent': '4.9.0 brand-samsung model-SM-G935F os-8.0.0 sl-L3 dstv-now-android-2.5.4',
    1|aos-http-proxy-1  |   'proxy-authorization': 'Basic c2Y4OjI3NDM=',
    1|aos-http-proxy-1  |   'content-type': 'application/json',
    1|aos-http-proxy-1  |   targethost: 'https://ssl.dstv.com',
    1|aos-http-proxy-1  |   accept: ' ',
1 | aos - http - proxy - 1 | 'postman-token': '5c127b79-d512-4255-8c31-4ac77e3baefd',
    1 | aos - http - proxy - 1 | host: '139.84.232.206:3001',
        1 | aos - http - proxy - 1 | 'accept-encoding': 'gzip, deflate, br',
            1 | aos - http - proxy - 1 | connection: 'keep-alive',
                1 | aos - http - proxy - 1 | 'content-length': '1851'
1 | aos - http - proxy - 1 | }
 */
/* _client.post<string>("https://ssl.dstv.com/connect/connect-authtoken/v2/accesstoken/refresh", {
    //_client.post<string>("http://webhook.site/e283ecdf-941b-49da-912f-2e6fab3dea8e", {
    "User-Agent": "4.9.0 brand-samsung model-SM-G935F os-8.0.0 sl-L3 dstv-now-android-2.5.4",
    "proxy-authorization": "Basic c2Y2NDoyNzQz",
    //"proxy-authorization": "Basic c2Y4OjI3NDM=",
    //"proxy-authorization": "Basic YXJpZjoyMDIz",
    "Connection": "keep-alive"
}, RequestType.String, PostRequestType.JSON, {
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImMyN2ZiNmY3LTIzNzAtNDg2MC04YTg0LTdlOGQ5MTY0YWFkOSJ9.eyJpc3MiOiJDb25uZWN0IEF1dGhUb2tlbiBJc3N1ZXIiLCJhdWQiOiI5MjI2YmI3ZC1iZDI2LTRiNzYtYmEyOC0yNTJkMGQwZWI2YzUiLCJqdGkiOiI0ZDE2ZTM4Yi1hNjFjLTQ3YjItYjdkZS05NDUyYTgyYmM4MTgiLCJpYXQiOjE2OTA3NzkwNTQsInN1YiI6Ijk4YzExZTdjLTJlYTAtNDUwMS1iZjEwLTNlYmZmNDQxMWRiNiIsImV4cCI6MTY5MDc3OTk1NCwiaWRUb2tlbkpUSSI6IjMyOTkyZmVhLWJmMWUtNGU1ZC04MjNhLWUwMjUyZDVjNTEyOSIsInBhY2thZ2UiOiJQUkVNSVVNIiwic3Vic2NyaXB0aW9uVHlwZSI6IkRUSCIsImFkZE9uUGFja2FnZXMiOltdLCJvbmNlT2ZmQXNzZXRzIjpbXSwiY291bnRyeSI6IlpBIiwiaXNWaXAiOmZhbHNlLCJyb2xlcyI6W119.K2rM2EVdKtFloKpjZXqzYwsnLXhPzbwo5S3E8T_b2bOZEbduv08bKgV9B4kjoKIS3oZFM-4jIbMmbzQsF9vzO7VTpbhdzbu9imrnHecB9fd1rV6oVIMZzT4Q0-aIabKSEVkUVje3bxywjukZENgckxOVivS_pYNqzav9tkp4MOeLknWUpX-JnqZYMw3YFWWV4tIiQZgS71PycpBF-YjqiCz5EfF0wbDzwJpNfZuCBot2z8Bp0MFcWpaAhyfNMKsZeQjAj1Yide-RQWaRMmLgnQJzWPoY3ttMKQOC94deeVKyAl1oKHYA1qHKO2rN7BCINsR1581e6vYqxNvkt0AuYw",
    "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6ImMyN2ZiNmY3LTIzNzAtNDg2MC04YTg0LTdlOGQ5MTY0YWFkOSJ9.eyJpc3MiOiJDb25uZWN0IEF1dGhUb2tlbiBJc3N1ZXIiLCJhdWQiOiI5MjI2YmI3ZC1iZDI2LTRiNzYtYmEyOC0yNTJkMGQwZWI2YzUiLCJqdGkiOiIzMjk5MmZlYS1iZjFlLTRlNWQtODIzYS1lMDI1MmQ1YzUxMjkiLCJpYXQiOjE2OTA3NzY0NDgsInN1YiI6Ijk4YzExZTdjLTJlYTAtNDUwMS1iZjEwLTNlYmZmNDQxMWRiNiIsImV4cCI6MTY5ODU1MjQ0OCwiZW1haWwiOiJsaWViZW5iZXJnamRAdWZzLmFjLnphIiwicHJlZmVycmVkX3VzZXJuYW1lIjoibGllYmVuYmVyZ2pkQHVmcy5hYy56YSIsInVzZXJuYW1lIjoibGllYmVuYmVyZ2pkQHVmcy5hYy56YSJ9.AeQgXFb62M7KsrWXJqZKJxAnW4PFlLi9JaFdycmIsH4_-EDm-dSxZ5UIoX1ydg17Dj0Auhl0S-F6ZmUcsTPwBQvpAufm1QwQYbAB_hAEMntQjwIJ8Sv1DIufb6bvWcpHr0VzFRgTjILH-TOYwEeoz3EWQtmbGeP_1jD_Elkp6tKg6yQKx1BbL7DXTwx96UA21v-El6djU60A0PjKuoJmoYjmU1KDt4YzqMrzV4UsuAmd_bCpAPt510S5iowGNusRaD55rs16Da7f82uoOe_Y-buRCRntYTFEeIrrpNk781BRWZqV7xeBxv_zJhvqkQ6b68PJvPvBIH-iKRtpKKU-tQ"
}, {
    dns: undefined,
    proxy: undefined,
    dnsAuto: undefined,
    cdnProxy: 'http://185.177.126.30:3002'
    //cdnProxy: 'http://localhost:5000'
}, "", "").then(data => {
    console.log('data', data);
}) */
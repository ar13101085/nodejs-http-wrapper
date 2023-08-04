import { HttpClientWrapper } from "../http-client/HttpClientWrapper";
import { PostRequestType, RequestType } from "../model/client";

const _client = new HttpClientWrapper("", 1, console);
// _client.get(`https://bpprod5linear.akamaized.net/bpk-tv/irdeto_com_Channel_250/output/manifest.mpd`, {
//     "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36"
// }, RequestType.String, {
//     cdnProxy: "http://ind.mrxtx.one:8080"
// }).then(res => {
//     console.log('res', res.data);
// })


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

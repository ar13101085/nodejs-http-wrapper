import { HttpClientWrapper } from "../http-client/HttpClientWrapper";
import { PostRequestType, RequestType } from "../model/client";
import { Readable } from "stream"
import fs from "fs";

const _client = new HttpClientWrapper("", 15, console);
/* const url = new URL(`http://localhost:8090/live/arif/test/193313`);
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
}) */

// _client.get<any>(`https://data.temp-files.xyz/data/-afp.jpg`, {}, RequestType.Stream, {}, "", "").then(res => {
//     //console.log(res.data);
//     res.data.pipe(fs.createWriteStream("./b.png"));
//     //fs.writeFileSync('./b.png', res.data);
// }).catch(err => {
//     console.log('error', err)
// })

// setInterval(() => {
//     console.log('interval');
// }, 5000)

_client.get('', {}, RequestType.Stream, {
}, '', '').then(data => {
    //console.log(data);
})
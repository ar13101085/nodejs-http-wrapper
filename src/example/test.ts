import { HttpClientWrapper } from "../http-client/HttpClientWrapper";
import { RequestType } from "../model/client";

const _client = new HttpClientWrapper("", 1, console);
_client.get(`https://ip-api.com/json`, {}, RequestType.String, {
    cdnProxy: "http://ind.mrxtx.one:8080"
}).then(res => {
    console.log('res', res.data);
})
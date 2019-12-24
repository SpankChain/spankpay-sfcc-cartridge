/*
SpankPay utility library
modified to work with SFCC
docs.spankpay.com
*/

const cryptoLib = require('dw/crypto');
const crypto = cryptoLib.Mac('HmacSHA256');

function decodeSpankPayWebhook(secret, sig, data) {
    if (!data || data.slice(0, 1) != '{') {
        const msg = (
            'Empty or non-JSON webhook data: ' +
            JSON.stringify(shorten(data))
        );
        return [null, null, msg];
    }

    const sigData = {};
    sig.split('&').forEach(function(bit) {
        const [key, val] = bit.split('=');
        sigData[key] = val;
    });

    const timestamp = parseInt(sigData.t);
    if (!isFinite(timestamp)) {
		return [null, null, 'Invalid or missing timestamp: ' + sig];
	}

	const hash = crypto.digest(timestamp + '.' + data, secret);
	const actualSig = cryptoLib.Encoding.toHex(hash);
	if (sigData.s !== actualSig) {
		return [null, null, 'Invalid signature. ' + sigData.s + ' !== ' + actualSig];
	}

    let dataObj;
    try {
        dataObj = JSON.parse(data);
    } catch (e) {
        return [null, null, 'Error decoding JSON: ' + e];
    }

    return [dataObj, timestamp, null];
}

function shorten(s, len) {
    if (!len) { len = 16; }
    if (!s || s.length <= len) { return s; }
    return s.slice(0, len / 2) + '…' + s.slice(s.length - len / 2);
}

function signSpankPayData(secret, data, t) {
    if (t === undefined) { t = parseInt(Date.now() / 1000); }
    const hash = crypto.digest(t + '.' + data, secret);
    return 't='+t+'&s='+cryptoLib.Encoding.toHex(hash);
}

module.exports = {
    decodeSpankPayWebhook: decodeSpankPayWebhook,
    signSpankPayData: signSpankPayData
};

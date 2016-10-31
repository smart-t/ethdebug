function parseUnknown(hex) {
    var rslt = "";
    if (hex == undefined) {return "";}
    for (var i = 0; i < hex.length; i += 64) {
        rslt += (rslt == "" ? "" : " ") + parseArg(undefined, hex.substr(i,64));
    }
    return rslt;
}

function parseArg(type, hex) {
    if (type == 'uint256' || (type == undefined && hex.substr(0,32) == "00000000000000000000000000000000")) {
        return parseInt(hex, 16);
    } else if (type == 'address' || (type == undefined && hex.substr(0,24) == "000000000000000000000000")) {
        return hex.substr(hex.length-40).substr(0,8);
    } else {
        var ascii = web3.toAscii(hex);
        if (ascii.indexOf('\0') < 0) {return ascii;}
        return ascii.substr(0, ascii.indexOf("\0"));
    }
}

function parseData(signature, data) {
    var argtypes = signature.split(",");
    var arglengths = {'bytes32': 32, 'bytes8': 8, 'address': 32, 'uint256': 32};
    var pos = 0;
    var rslt = "";
    for (var i = 0; i < argtypes.length; i++) {
        var type = argtypes[i];
        var len = arglengths[type] * 2; //bytes to hex
        rslt += (rslt == "" ? "" : " ") + parseArg(type, data.substr(pos,len));
        pos += len;
    }
    return rslt;
}

module.exports = {parseUnknown: parseUnknown, parseArg: parseArg, parseData: parseData}
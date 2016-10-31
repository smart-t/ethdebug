var parser = require('./input-parser');

var knownfuncs = {};

function tryget(m, s) {
    return m === undefined || m[s] === undefined ? s : m[s];
}

function trygetNoParams(m, s) {
    var functionSignature = tryget(m, s);
    if (functionSignature.indexOf("(") > 0) {
        return functionSignature.substr(0, functionSignature.indexOf("("));
    } else {
        return functionSignature;
    }
}

// Mini stack trace shows only the numeric error location per contract
function formatMiniStackTrace(stacktrace) {
    if (stacktrace.length == 0) {console.warn("No stack trace to print");return "";}
    var loc = "";
    var contract;
    for (var i = 0; i < stacktrace.length; i++) {
        if (stacktrace[i].contract != contract) {
            contract = stacktrace[i].contract;
            loc = stacktrace[i].pc + (loc == "" ? "" : "-" + loc);
        }
    }
    return stacktrace[0].result + " at " + loc;
}

// Format the stack trace using method signatures
function formatStackTrace(trace) {
    if (trace.length == 0) {console.warn("No stack trace to print");return "";}
    var rslt = formatMiniStackTrace(trace);
    for (var i = 0; i < trace.length; i++) {
        var callstr = tryget(knownfuncs, trace[i].func);
        var parsedCall;
        if (callstr.indexOf("(") > 0) {
            // Parse arguments
            var signature = callstr.substring(callstr.indexOf("(")+1,callstr.indexOf(")"));
            var argtypes = signature == "" ? [] : signature.split(",");
            if (argtypes.length != trace[i].params.length) {
                parsedCall = callstr.substring(0,callstr.indexOf("("));
            } else {
                parsedCall = callstr.substring(0,callstr.indexOf("(")+1);
                for (var arg = 0; arg < Math.min(argtypes.length, trace[i].params.length); arg++) {
                    if (arg > 0) {parsedCall += ",";}
                    //console.info("Parsing " + trace[i].params[arg] + " as " + argtypes[arg] + " --> " + parseArg(argtypes[arg], trace[i].params[arg]));
                    parsedCall += parser.parseArg(argtypes[arg], trace[i].params[arg]);
                }
                parsedCall += ')';
            }
        } else {
            parsedCall = callstr + "(";
            for (var arg = 0; arg < trace[i].params.length;arg++) {
                if (arg > 0) {parsedCall += ",";}
                parsedCall += parser.parseUnknown(trace[i].params[arg]);
            }
            parsedCall += ')';
        }
        if (parsedCall == "main()") {parsedCall = "main";}
        rslt += "\n  " + link(trace[i].contract) + "." + parsedCall + ":" + trace[i].pc;
    }
    return rslt;
}

function link(x,y) {return "<a href='/list/" + x + "'>" + (y ? y : x) + "</a>";}

function formatRow(rslt) {
    var info = "";
    if (rslt.stacktrace) {
        info = "<pre style='margin:0'>" + formatStackTrace(rslt.stacktrace, knownfuncs).trim() + "</pre>";
    } else if (rslt.created) {
        rslt.parsedInput = rslt.created.parsedInput;
        info = "<b>Contract: " + link(rslt.created.address) + "</b><br />" + rslt.created.size + " bytes, hash: " + link(rslt.created.hash);
    } else if (rslt.events) {
        for (var j = 0; j < rslt.events.length; j++) {
            info += link(rslt.events[j].from) + ": " + link(rslt.events[j].event, trygetNoParams(knownfuncs, rslt.events[j].event)) + " " + rslt.events[j].parsedIndexes + " > " + rslt.events[j].parsedData + "<br />";
        }
    } else if (rslt.block == "")  {
        info = "Pending";
    }
    
    var color = "#fff";
    if (rslt.status.includes("Failed")) {
        color = "#f99";
        if (rslt.stacktrace && rslt.stacktrace.length > 0 && rslt.stacktrace[0].result == "Out of gas") 
            color = "#fc9";
    } else if (rslt.status == "Succeeded" || rslt.status == "Created") {
        color = "#9f9";
    }
    
    var dt = rslt.dt.toString();
    return "<tr style='background-color:" + color + "'><td><a href='/block/"+rslt.block + "'>" + rslt.block + "</a></td><td>" + dt.substring(0,24) + "</td><td>" + link(rslt.src) + "</td><td>" + link(rslt.dst) + "</td><td>" + link(rslt.method, trygetNoParams(knownfuncs, rslt.method)) + "</td><td>" + rslt.parsedInput + "</td><td>" + info + "</td></tr>";
}

function formatTable(list, filter) {
    if (filter == undefined) filter = "";
    var table = "<table style='font-family:sans-serif;font-size:12px' border='1'><tr><th>Block</th><th>Date</th><th>From</th><th>To</th><th>Method</th><th>Parsed input</th><th>Details</th></tr>";
    var count = 0;
    for (var i =0; i < list.length; i++) {
        var row = formatRow(list[i], knownfuncs);
        if (row.includes(filter)) {
            count++;
            table += row;
        }
    }
    table += "</table>";
    return {count: count, table: table};
}

function addHash(hash, original) {
    knownfuncs[hash] = original;
}

module.exports = {formatTable: formatTable, addHash: addHash};

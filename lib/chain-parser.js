var parser = require('./input-parser');

// Load all information on the transactions in a specific block
function printBlock(i, cb) {
    web3.eth.getBlock(i, printBlock2);
    
    function printBlock2(err, b) {
        if (err) {console.error("Received error response from web3.eth.getBlock(" + i + ")");}

        function addTransDetail(rslt) {
            var dt = new Date(b.timestamp * 1000);
            rslt.dt = dt;
            rslt.block = i;
            list.push(rslt);
            if (list.length == b.transactions.length) {cb(list);}
        }
    
        var list = [];
        for (var t = 0; t < b.transactions.length; t++) {
            transactionDetail(b.transactions[t], addTransDetail);
        }
        if (b.transactions.length == 0) cb(list);
    }
}

// Get all information on pending transactions
function printPending(cb) {
    var pending = web3.eth.pendingTransactions;
    var list = [];
    for (var t = 0; t < pending.length; t++) {
        transactionDetail(pending[t].hash, addTransDetail);
    }
    if (pending.length == 0) cb(list);
    
    function addTransDetail(rslt) {
        var dt = new Date();
        rslt.dt = dt;
        rslt.block = "";
        list.push(rslt);
        if (list.length == pending.length) {cb(list);}
    }
}

// Get all information on a transaction
function transactionDetail(tx, cb) {
    web3.eth.getTransaction(tx, transactionDetail2);
    var trans;
    
    function transactionDetail2(err, t) {
        if (err) {console.error("Received error response from web3.eth.getTransaction(" + tx + ")");}

        trans = t;
        getTransactionStatus(trans, transactionDetail3);
    }
    
    function transactionDetail3(rslt) {
        rslt.src = trans.from.substr(2,8);
        rslt.dst = (trans.to == null ? "< New >" : trans.to.substr(2,8));
        rslt.method = (trans.to == null ? "" : trans.input.substr(2,8));
        rslt.input = trans.input.substr(10);
        rslt.parsedInput = (trans.to == null ? "< Code >" : parser.parseUnknown(rslt.input));
        cb(rslt);
    }
}

// Determine the status of a transaction
function getTransactionStatus(trans, cb) {
    var rslt = {}
    if (trans.blockNumber == null) {
        rslt.status = "Pending";
        cb(rslt);
    } else if (trans.to == null && trans.input == "0x") {
        rslt.status = "Failed to store";
        cb(rslt);
    } else {
        web3.eth.getTransactionReceipt(trans.hash, getTransactionStatus2);
    }
    
    function getTransactionStatus2(err, receipt) {
        if (err) {console.error("Received error response from web3.eth.getTransactionReceipt(" + trans.hash + ")");}

        rslt.events = [];
        if (receipt.logs != undefined) {
            for (var i = 0; i < receipt.logs.length; i++) {
                var ev = receipt.logs[i];
                var indexes = [];
                var parsedIndexes = [];
                for (var t = 1; t < ev.topics.length; t++) {
                    indexes.push(ev.topics[t]);
                    parsedIndexes.push(parser.parseArg(undefined, ev.topics[t]));
                }
                rslt.events.push({event: ev.topics[0].substr(2,8), from: ev.address.substr(2,8), indexes: indexes, parsedIndexes: parsedIndexes, data: ev.data.substr(2), parsedData: parser.parseUnknown(ev.data.substr(2))});
            }
        }
        if (trans.gas == receipt.gasUsed && receipt.logs.length == 0) {
            rslt.status = "Failed";
            getStackTrace(trans, getTransactionStatus3Failed);
            
            function getTransactionStatus3Failed(x) {
                rslt.stacktrace = x;
                cb(rslt);
            }
        } else if (trans.to == null) {
            var contract = receipt.contractAddress.substr(2,8);
            web3.eth.getCode(receipt.contractAddress, getTransactionStatus3Created);
                    
            function getTransactionStatus3Created(err, code) {
                if (err) {console.error("Received error response from web3.eth.getCode(" + receipt.contractAddress + ")");}

                code = code.substr(2);
                var bytes = code.length / 2;
                var codeHash = web3.sha3(web3.eth.getCode(receipt.contractAddress)).substr(2,8);
                var args = trans.input.substr(trans.input.indexOf(code) + code.length);
                rslt.status = "Created";
                rslt.created = {address: contract, size: bytes, hash: codeHash, input: args, parsedInput: parser.parseUnknown(args)};
                cb(rslt);
            }
        } else {
            rslt.status = "Succeeded";
            cb(rslt);
        }
    }
}

// Try to find out what condition failed and triggered a throw in Solidity
function findThrowCondition(traces, i) {
    if (traces[i].error != null
        && traces[i-1].op == "JUMP"
        && traces[i-1].stack[traces[i-1].stack.length-1] == "0000000000000000000000000000000000000000000000000000000000000002"
        && traces[i-2].op == "PUSH2"
        && traces[i-3].op == "JUMPI"
        && traces[i-4].op == "PUSH2"
        && traces[i-5].op == "ISZERO") {
        var condition = traces[i-6].op == "ISZERO" ? traces[i-7] : traces[i-6];
        var stack = condition.stack;
        if (condition.op == "EQ" || condition.op == "GT" || condition.op == "LT") {
            return parser.parseUnknown(stack[stack.length-1]) + " " + condition.op + " " + parser.parseUnknown(stack[stack.length-2]);
        } else {
            return "";
        }
    } else {
        // Trace does not match the pattern for a conditional throw
        return "";
    }
}

// Trace a transaction execution and build stack trace in case of error
function getStackTrace(trans, cb) {
    web3.debug.traceTransaction(trans.hash, getStackTrace2);
    
    function getStackTrace2(err, trace) {
        if (err) {
            var rslt = [{contract: trans.to != null ? trans.to.substr(2,8) : "New", func: "", params: [], pc: "", result: "Unknown error (Tracing disabled)"}];
            return cb(rslt);
        }
        var traces = trace.structLogs;
        var stack = {};
        var errors = {};
        var functions = {};
        stack[1] = [{pc: 0, name: "main", params: [], contract: trans.to != null ? trans.to.substr(2) : ""}];
        functionsAt(stack[1][0].contract, function (x) {functions[1] = x; continueTracing(0);});
        
        function continueTracing(start) {
            for (var i = start; i < traces.length; i++) {
                var trace = traces[i];
                if (i != traces.length - 1 && trace.depth < traces[i+1].depth) {
                    if (trace.op == "CREATE") {
                        var newAddr = "";
                    } else {
                        var newAddr = trace.stack[trace.stack.length-2].substr(64-40);
                    }
                    //console.info("Calling external contract at " + i + ": " + newAddr);
                    stack[trace.depth+1] = [{pc: 0, name: "main", params: [], contract: newAddr}];
                    delete errors[trace.depth+1];
                    functionsAt(newAddr, functionsAtReturned);
                    
                    function functionsAtReturned(r) {
                        functions[trace.depth+1] = r;
                        continueTracing(i+1);
                    }
                    
                    return;
                }
                if (trace.op == "JUMP") {
                    var newPC = trace.stack[trace.stack.length-1].substr(64-4);
                    var jumpOutLocation = (stack[trace.depth][stack[trace.depth].length-1].pc+1).toString(16);
                    //console.info("Called local function at " + newPC);
                    var calledFunc = functions[trace.depth].entrypoints[newPC];
                    if (calledFunc != undefined) {
                        var inputCount = functions[trace.depth].inputs[calledFunc];
                        var params = [];
                        for (var arg = 0; arg < inputCount; arg++) {
                            params.push(trace.stack[trace.stack.length-1-inputCount+arg]);
                        }
                        stack[trace.depth].push({pc: trace.pc, name: calledFunc, params: params});
                    }
                    if (parseInt(newPC,16).toString(16) == jumpOutLocation) {
                        //console.info("Going out of function");
                        stack[trace.depth].pop();
                    }
                }
                if (i == traces.length - 1 || trace.depth > traces[i+1].depth) {
                    //console.info("Contract execution stopped");
                    if (trace.error != null) {
                        // Mark the error
                        var aborted = traces[i].gas <= traces[i].gasCost;
                        var throwActivated = findThrowCondition(traces, i);
                        var result = aborted ? "Out of gas" : "Error" + (throwActivated == "" ? "" : " ") + throwActivated;
                        stack[trace.depth].push({pc: trace.pc, result: result});
                        errors[trace.depth] = stack[trace.depth];
                    } else {
                        delete errors[trace.depth];
                    }
                    delete stack[trace.depth];
                }
            }
            // Re-order data in a logical way
            var rslt = [];
            var depth = 0;
            while (errors[depth+1] != undefined) depth++;
            for (var i = depth; i >= 1; i--) {
                var substack = errors[i];
                var contract = substack[0].contract.substr(0,8);
                var result = substack[substack.length-1].result;
                for (var j = substack.length - 2; j >= 0; j--) {
                    rslt.push({contract: contract, func: substack[j].name, params: substack[j].params, pc: substack[j+1].pc, result: result});
                }
            }
            cb(rslt);
        }
    }
}

// Load the functions in compiled Solidity code
// We first load the function index with patterns 8063xxxxxxxx1461yyyy57, x = keccak256 of function signature, y = starting byte of function I/O code
// Then load the function I/O code for each function and determine the position of the actual function and the number of arguments
function functionsAt(addr, cb) {
    if (addr == undefined || addr == null || addr == "") {return cb({entrypoints: {}, inputs: {}});}
    web3.eth.getCode(addr, functionsAt2);
    
    function functionsAt2(err, code) {
        if (err) {console.error("Received error response from web3.eth.getCode(" + addr + ")");}
        code = code.substr(2);
    library = false;
        // Solidity 0.4 - Version marker for libraries: PUSH6 xx xx xx xx xx xx POP
        if (code.substr(0,1*2) == "65" && code.substr(7*2,1*2) == "50") {
            code = code.substr(8*2); // Ignore it
            library = true;
        }
        
        var recognizedStart = (code.substr(0,40*2) == '60606040526000357c01000000000000000000000000000000000000000000000000000000009004') || (code.substring(0,8*2) == '6060604052361561' && code.substring(10*2,46*2) == '576000357c01000000000000000000000000000000000000000000000000000000009004');
        if (!recognizedStart) {
            console.warn("Contract " + addr + " starts with unexpected pattern for Solidity compiled bytecode");
        }
        var pos = code.indexOf("8063");
        var table = {};
        var inputsize = {};
        var funchash = [];
        var inputpos = [];
        while (code.substr(pos,2*2) == "8063" && code.substr(pos+6*2,2*2) == "1461" && code.substr(pos+10*2,1*2) == "57") {
            var f = code.substr(pos+2*2,4*2);
            var entry = parseInt(code.substr(pos+8*2,2*2),16);
            funchash.push(f);
            inputpos.push(entry);
            pos += 11*2;
        }
        for (var i = 0; i < funchash.length; i++) {
            var inputfunc = code.substring(inputpos[i]*2);
            var pos_stop_no_output = inputfunc.indexOf("565b005b") // JUMP JUMPDEST STOP JUMPDEST
            var pos_output_begin = inputfunc.indexOf("565b604051") // JUMP JUMPDEST PUSH2 0x40 MLOAD
            var pos_output_return = inputfunc.indexOf("910390f35b") // SWAP2 SUB SWAP1 RETURN JUMPDEST
            // A compiled Solidity method either has a stop pattern (if no output) or a continuation and return pattern (if output)
            // The last 2 bytes before this pattern indicate the starting position of the actual function
            if (pos_stop_no_output < 0 && (pos_output_begin < 0 || pos_output_return < 0)) {
                console.warning("Warning: Unparsable function I/O code: " + addr);
                continue;
            }
            var has_output = (pos_output_begin >= 0 && !(pos_stop_no_output >= 0 && pos_stop_no_output < pos_output_begin));
            var pos_jump_after_function = has_output ? pos_output_begin : pos_stop_no_output;
            // Where does the actual function start?
            var entryPoint = inputfunc.substring(pos_jump_after_function-2*2,pos_jump_after_function);
            table[entryPoint] = funchash[i];
            // Count number of input arguments = occurrences of 803590 (DUP1 CALLDATALOAD SWAP1)
            var inputCount = 0;
            var inputLoadCode = inputfunc.substr(0,pos_jump_after_function);
            while (inputLoadCode.indexOf("803590") > 0) {
                inputLoadCode = inputLoadCode.substr(inputLoadCode.indexOf("803590")+6);
                inputCount++;
            }
            inputsize[funchash[i]] = inputCount;
            //console.info("Function " + funchash[i] + " starts at " + entryPoint + " and has " + inputCount + " arguments");
        }
        cb({entrypoints: table, inputs: inputsize});
    }
}

module.exports = {printPending: printPending, printBlock: printBlock};

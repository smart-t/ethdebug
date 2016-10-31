var Web3 = require('web3');
var Web3Method = require('web3/lib/web3/method');
var Web3Property = require('web3/lib/web3/property');

// Patch the web3 interface so we can access pending transactions and the trace tool
function getWeb3() {
    web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
    
    try {
        var block = web3.eth.blockNumber;
        console.info("Web3 connection successful, latest block = " + block);
    } catch (e) {
        console.error("Web3 connection failed! " + e.message);
        return null;
    }
    
    web3.debug = {};
    
    var tracer = new Web3Method({name:'traceTransaction', call: 'debug_traceTransaction', params:1});
    tracer.attachToObject(web3.debug);
    tracer.setRequestManager(web3._requestManager);

    var pending = new Web3Property({name:'pendingTransactions', getter: 'eth_pendingTransactions'});
    pending.attachToObject(web3.eth)
    pending.setRequestManager(web3._requestManager);
    
    web3.debug.traceTransaction("0x0000000000000000000000000000000000000000000000000000000000000000", checkEndpoint);
    return web3;
    
    function checkEndpoint(error, result) {
        if (error && error.message.includes("not available")) {
            console.warn("===========================================================================");
            console.warn("Your Ethereum node does not provide access to debug.traceTransaction method");
            console.warn("This can be enabled in geth by setting --rpcapi \"eth,net,web3,debug\"");
            console.warn("Continuing without tracing failed transactions. Out-of-gas transactions will now look like regular failed transactions.");
            console.warn("===========================================================================");
        }
    }
}

module.exports = getWeb3();

var cache = [];
var latest;
var first;
var chain;
const LOAD_OLD_TRANSACTIONS = 5000;

function updater() {
    var block = web3.eth.blockNumber;
    if (block > latest) {
        var newBlock = latest+1;
        chain.printBlock(newBlock, insertResult);
        latest++;
    }
    setTimeout(updater, 1000);
    
    function insertResult(tlist) {
        for (var i = 0; i < tlist.length; i++) {
            cache.splice(i, 0, tlist[i]);
        }
    }
}

function loader() {
    if (first > 0) {
        var newBlock = first-1;
        first--;
        chain.printBlock(newBlock, appendResult);
    }

    function appendResult(tlist) {
        for (var i = 0; i < tlist.length; i++) {
            cache.push(tlist[i]);
        }
        if (cache.length < LOAD_OLD_TRANSACTIONS) {
            loader();
        }
    }
}

function start(web3, _chain) {
    first = web3.eth.blockNumber;
    latest = first - 1;
    chain = _chain;
    updater();
    setTimeout(loader, 200);
}

function getCache() {
    return cache;
}

function status() {
    return (first > 0 ? "Loaded data since block " + first : "");
}

module.exports = {start: start, cache: getCache, status: status}


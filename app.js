var express = require('express');
var db = require('./lib/memory-db');
var web3 = require('./lib/web3-patch');
var chain = require('./lib/chain-parser');
var views = require('./lib/views');
var app = express();

try {
    addKnownFuncs(require('./knownfuncs.json'));
} catch (e) {}

function addKnownFuncs(funclist) {
    for (var i = 0; i < funclist.length; i++) {
        var hash = web3.sha3(funclist[i]).substr(2,8);
        views.addHash(hash, funclist[i]);
    }
}

function viewer(req, res) {
    chain.printPending(reply);
    
    function reply(pending) {
        var results = views.formatTable(pending.concat(db.cache()), req.params.filter);
        var header = (req.params.filter == undefined ? "Transactions" : "Results for " + req.params.filter) + " (" + results.count + ")";
        var footer = "<p>" + db.status() + "</p>";
        res.send("<h2>" + header + "</h2>" + results.table + footer);
    }
}

app.get('/list', viewer);
app.get('/list/:filter', viewer);

app.get('/block/:block', function (req,res) {
    var b = req.params.block;
    chain.printBlock(b, list => res.send('<h2>Block ' + b + '</h2>' + views.formatTable(list).table));
});

app.get('/func/:func', function (req, res) {
    addKnownFuncs(req.params.func.split(";"));
    res.send("Function hashes added");
});

if (web3 != null) {
    db.start(web3, chain);
    app.listen(8003, x => console.log('Listening on port 8003, check http://localhost:8003/list'));
}
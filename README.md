# ethdebug
Transaction debugging tool for Ethereum

## How to run
The program connects over RPC to an Ethereum node, by default at `http://localhost:8545`. It provides a web interface at port 8003.
- Start `geth` if not running, including arguments `--rpc --rpcapi "eth,debug"`
- `npm install`
- `npm start` or `npm start http://<rpc-host>:<rpc-port>`
- Navigate to `http://localhost:8003/list`

## What it shows
* Block number and timestamp
* Transaction sender and recipient
* Function name (or its hash) of the invoked method
* Function parameters (parsing bytes32, uint256 and address)
* New contract deployment: contract address + size and hash of the deployed bytecode
* Events triggered by transactions: event name (or its hash) and parameters (parsing bytes32, uint256 and address)
* Transaction result: Pending, Successful, Out of gas, Error
* If error occurred in a Solidity-based contract, a stacktrace is displayed showing which function triggered the error.
* An attempt to recognize the condition triggering a failure, such as a check on (in)equality of two values.

## Decoding function signatures
Because Solidity function signatures are hashed during compilation, we can't display the original function names.
To work around this, the original function signatures for your application can be entered, so the app can recognize the hashes.
This list can be provided as a file `knownfuncs.json` in the main directory. It should contain a single JSON list of strings, e.g. `["add(uint256)", "sub(uint256)"]`. Alternatively, it can be provided at run-time through HTTP, e.g. `http://localhost:8003/func/add(uint256);sub(uint256)`

## Disclaimer
This is experimental software and not production-ready. It is designed for private, small-scale Ethereum networks where it is useful to see a list of all recent and incoming transactions on the blockchain.

# Cloud Mining smart contract

Designed to be used on Binance Smart Chain.

```shell
npm install
npx hardhat test

npx hardhat deploy --mint 100 --min 1 --fee 20 --dryrun 1

npx hardhat mint --address <address> --amount 100
npx hardhat setprice --address <address> --token <address> --price 100
npx hardhat balance --address <address>
npx hardhat summary --address <address>

npx hardhat accounts

npx hardhat compile
npx hardhat clean
npx hardhat node
node scripts/sample-script.js
npx hardhat help
```

## Useful links:

https://bscscan.com/
https://bscscan.com/verifyContract

https://testnet.bscscan.com/
https://testnet.bscscan.com/verifyContract

# Flash Loan Arbitrage Bot

This project includes a smart contract that can loan tokenA from the aave protocol, swap tokenA for tokenB on Uniswap or Curve and swap back tokenB for tokenA on Curve or Uniswap respectively.

Try running some of the following tasks:

```shell
npx hardhat run --network mainnet scripts/deploy-flashloan-arb.js
npx hardhat run scripts/arbitrageBot.js --network mainnet
```

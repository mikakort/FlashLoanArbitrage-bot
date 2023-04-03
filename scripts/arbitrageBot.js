const fetch = require("node-fetch");
const { ethers } = require("hardhat");
const { BigNumber } = ethers;

const contractABI = require("./ABIS/flashLoanContract");
const poolABI = require("./ABIS/UniswapV3Pool");

const contractAddress = "0xE8874cAAeB112AdA6e2189a573fDdb4056176aBB";
const poolAddress = "0x3416cF6C708Da44DB2624D63ea0AAef7113527C6";

async function getProfitability() {
    const response = await fetch(
        `https://api-goerli.etherscan.io/api?module=proxy&action=eth_gasPrice&apikey=${process.env.ETHERSCAN_API_KEY}`
    );
    const jsonRes = await response.json();
    const gasPrice = parseInt(jsonRes.result, 16) / 1e9;
    const gasUnits = 296802;
    const arbCost = (gasPrice * gasUnits) / 1e9;
    console.log(`Gas price: `, gasPrice, ` Gwei`);
    console.log(`Arbitrage cost: `, arbCost, ` eth`);

    const signer = await ethers.getSigner();
    const poolContract = new ethers.Contract(poolAddress, poolABI, signer);
    const slot0 = await poolContract.slot0();
    const sqrtPriceX96 = slot0.sqrtPriceX96.toString();
    const exchangeRate = (sqrtPriceX96 / 2 ** 96) ** 2;
    console.log(sqrtPriceX96);
    console.log(exchangeRate); // use 12 decimals
}

getProfitability();

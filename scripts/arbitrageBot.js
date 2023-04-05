const fetch = require("node-fetch");
const { ethers } = require("hardhat");
const fs = require("fs");

const contractABI = require("./ABIS/flashLoanContract");
const poolABI_Uniswap = require("./ABIS/UniswapV3Pool");
const poolABI_Curve = require("./ABIS/CurvePool");

const contractAddress = "0xE8874cAAeB112AdA6e2189a573fDdb4056176aBB";
const poolAddress_Uniswap = "0x3416cF6C708Da44DB2624D63ea0AAef7113527C6";
const poolAddress_Curve = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";

async function getProfitability() {
    const time = new Date();
    console.log(
        "//////////////////////////////////////////////////////////////////////////////////// " +
            time
    );
    const gecko = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";
    let ethPrice;
    fetch(gecko)
        .then((response) => response.json())
        .then((data) => {
            ethPrice = data.ethereum.usd;
            console.log("ETH/USD ", ethPrice);
        })
        .catch((error) => console.error(error));

    const response = await fetch(
        `https://api.etherscan.io/api?module=proxy&action=eth_gasPrice&apikey=${process.env.ETHERSCAN_API_KEY}`
    );
    const jsonRes = await response.json();
    const gasPrice = parseInt(jsonRes.result, 16) / 1e9;
    const gasUnits = 296802;
    const arbCost = (gasPrice * gasUnits) / 1e9;
    console.log(`Gas price: `, gasPrice, ` Gwei`);
    console.log(`Arbitrage cost: `, arbCost, ` eth`);
    console.log(`Arbitrage cost: `, arbCost * ethPrice, ` USD`);

    const signer = await ethers.getSigner();

    const poolContract_Uniswap = new ethers.Contract(poolAddress_Uniswap, poolABI_Uniswap, signer);
    const slot0 = await poolContract_Uniswap.slot0();
    const raw_liquidity_Uniswap = await poolContract_Uniswap.liquidity();
    const liquidity_Uniswap = Number(raw_liquidity_Uniswap.toString());  // just retarded fr
    const sqrtPriceX96 = slot0.sqrtPriceX96.toString();
    const exchangeRate_Uniswap = (sqrtPriceX96 / 2 ** 96) ** 2;
    console.log("USDC/USDT:", exchangeRate_Uniswap); // USDC/USDT

    const poolContract_Curve = new ethers.Contract(poolAddress_Curve, poolABI_Curve, signer);
    const raw_liquidity_USDC_Curve = await poolContract_Curve.balances(1);
    const raw_liquidity_USDT_Curve = await poolContract_Curve.balances(2);
    const liquidity_Curve = raw_liquidity_USDC_Curve * raw_liquidity_USDT_Curve;  // 6 decimals
    const dy = await poolContract_Curve.get_dy(2, 1, 1e12);
    const exchangeRate_Curve = Number(dy / 1e12); // USDT/USDC
    console.log("USDT/USDC:", exchangeRate_Curve);
    634309567130289300;

    const gapPercentageA = ((exchangeRate_Uniswap * exchangeRate_Curve - 1) * 100) / 1;
    console.log(gapPercentageA);

    const gapPercentageB = (((1 / exchangeRate_Curve) * (1 / exchangeRate_Uniswap) - 1) * 100) / 1;
    console.log(gapPercentageB);

    const tradeSizeA =
        gapPercentageA > 0
            ? liquidity_Uniswap * gapPercentageA
            : liquidity_Uniswap * gapPercentageB;
    console.log(liquidity_Uniswap, tradeSizeA);
    console.log(
        "////////////////////////////////////////////////////////////////////////////////////"
    );

    // Read data.json file
    fs.readFile("data.json", "utf8", (err, data) => {
        if (err) throw err;

        const arr = JSON.parse(data);

        arr.push({ time: time, a: gapPercentageA, b: gapPercentageB });

        fs.writeFile("data.json", JSON.stringify(arr), (err) => {
            if (err) throw err;
        });
    });
}

setInterval(() => {
    getProfitability();
}, 10000);

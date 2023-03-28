const { TickMath } = require("@uniswap/v3-sdk");
const { BigNumber } = require("ethers");

// Desired initial exchange rate
const exchangeRate = 1;

// Calculate tick corresponding to desired exchange rate
const tick = TickMath.getTickAtSqrtRatio(BigNumber.from(Math.round(exchangeRate * 2 ** 96)));

// Calculate square root price corresponding to calculated tick
const sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tick);

console.log(sqrtPriceX96);

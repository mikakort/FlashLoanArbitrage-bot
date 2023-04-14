const fetch = require("node-fetch");
const { ethers } = require("hardhat");
const fs = require("fs");

const poolABI_Uniswap = require("./ABIS/UniswapV3Pool");
const poolABI_Curve = require("./ABIS/CurvePool");
const contractABI = require("./ABIS/flashLoanContract");

const U_addresses = [
    {
        pair: "USDC/USDT",
        address: "0x3416cF6C708Da44DB2624D63ea0AAef7113527C6",
        e: 0,
    },
    {
        pair: "DAI/USDC",
        address: "0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168",
        e: 12,
    },
    {
        pair: "WETH/USDT",
        address: "0x11b815efB8f581194ae79006d24E0d814B7697F6",
        e: 12,
    },
];
const C_addresses = [
    {
        pair: "USDT/USDC",
        address: "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
        r: [2, 1],
        e: 0,
        abi: 0,
    },
    {
        pair: "USDC/DAI",
        address: "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
        r: [1, 0],
        e: 12,
        abi: 0,
    },
    {
        pair: "USDT/WETH",
        address: "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46",
        r: [0, 2],
        e: 12,
        _e: 1e6,
        abi: 1,
    },
];

function findH_quadratic(a, b, c) {
    let discriminant = b * b - 4 * a * c;
    let x1 = (-b + Math.sqrt(discriminant)) / (2 * a);
    let x2 = (-b - Math.sqrt(discriminant)) / (2 * a);
    return (x1 + x2) / 2;
}

async function arbitrageProfitLogger() {
    const time = new Date();
    const signer = await ethers.getSigner();
    let logs = [];

    const response = await fetch(`https://api.etherscan.io/api?module=proxy&action=eth_gasPrice&apikey=${process.env.ETHERSCAN_API_KEY}`);
    const jsonRes = await response.json();
    const gasPrice = parseInt(jsonRes.result, 16) / 1e9;
    const gasUnits = 296802;
    const arbCost = (gasPrice * gasUnits) / 1e9;

    if (U_addresses.length === C_addresses.length) {
        for (i = 0; i < U_addresses.length; i++) {
            const poolContract_Uniswap = new ethers.Contract(U_addresses[i].address, poolABI_Uniswap, signer);
            const poolContract_Curve = new ethers.Contract(C_addresses[i].address, poolABI_Curve[C_addresses[i].abi], signer);

            const slot0 = await poolContract_Uniswap.slot0();
            const sqrtPriceX96 = slot0.sqrtPriceX96.toString();
            const exchangeRate_Uniswap = (sqrtPriceX96 / 2 ** 96) ** 2 * 10 ** U_addresses[i].e * 1.0005;
            console.log(U_addresses[i].pair, exchangeRate_Uniswap);
            console.log(1 / exchangeRate_Uniswap);

            const dy = await poolContract_Curve.get_dy(C_addresses[i].r[0], C_addresses[i].r[1], 1e11);
            const exchangeRate_Curve = Number(dy / 1e11) / 10 ** C_addresses[i].e;

            const _dy = await poolContract_Curve.get_dy(C_addresses[i].r[1], C_addresses[i].r[0], "1000000000000000000");
            const _exchangeRate_Curve = C_addresses[i]._e ? Number(_dy / C_addresses[i]._e) : 1 / exchangeRate_Curve;

            console.log(C_addresses[i].pair, exchangeRate_Curve);
            console.log(_exchangeRate_Curve);

            const arbitrageProfitA = (exchangeRate_Uniswap * exchangeRate_Curve - 1) * 100;
            const arbitrageProfitB = (_exchangeRate_Curve * (1 / exchangeRate_Uniswap) - 1) * 100;

            if (arbitrageProfitA > arbitrageProfitB) {
                logs.push({
                    time: time,
                    route: `Uniswap: ${U_addresses[i].pair} to Curve: ${C_addresses[i].pair}`,
                    ROS: arbitrageProfitA,
                });
            } else {
                logs.push({
                    time: time,
                    route: `Curve: ${C_addresses[i].pair} (flipped) to Uniswap: ${U_addresses[i].pair} (flipped)`,
                    ROS: arbitrageProfitB,
                });
            }
            const _arbitrageProfitA = arbitrageProfitA / 100;
            const _arbitrageProfitB = arbitrageProfitB / 100;

            const interest = 0.09 / 100;
            const feeTotal = interest;
            const slip = -0.0001 / 100;

            if (_arbitrageProfitA > feeTotal) {
                const profitableSwapAmount = findH_quadratic(slip, _arbitrageProfitA - feeTotal, arbCost * -2);
                console.log(arbCost);
                console.log(profitableSwapAmount);
                const estimatedProfit = slip * profitableSwapAmount ** 2 + (_arbitrageProfitA - feeTotal) * profitableSwapAmount + arbCost * -2;
                console.log(estimatedProfit);
            } else if (_arbitrageProfitB > feeTotal) {
                const profitableSwapAmount = findH_quadratic(slip, _arbitrageProfitB - feeTotal, arbCost * -2);
                console.log("____________________________");
                console.log("                            ");
                console.log("Amount: ", profitableSwapAmount);
                const estimatedProfit = slip * profitableSwapAmount ** 2 + (_arbitrageProfitB - feeTotal) * profitableSwapAmount + arbCost * -2;
                console.log("Profit in ETH: ", estimatedProfit);
                console.log("____________________________");
                console.log("                            ");
                console.log(_arbitrageProfitB - feeTotal);
                console.log(arbCost * 2);
                console.log("____________________________");
                fs.readFile("estimatedProfit.json", "utf8", (err, data) => {
                    if (err) throw err;

                    const arr = JSON.parse(data);
                    arr.push({ t: time, p: estimatedProfit, a: profitableSwapAmount });

                    fs.writeFileSync("estimatedProfit.json", JSON.stringify(arr), (err) => {
                        if (err) throw err;
                    });
                });

                const C_liquidity = await poolContract_Curve.balances(0);
                // Call request flash loan with asset and amount

                const botContractAddress = "0x...."
                if(profitableSwapAmount > 0 && estimatedProfit > 0.00001) {
                    const flashLoanArbitrageContract = new ethers.Contract(botContractAddress, contractABI, signer);
                    await flashLoanArbitrageContract.requestFlashLoan(profitableSwapAmount)
                }
            }
        }
        fs.readFile("arbProfitLogs.json", "utf8", (err, data) => {
            if (err) throw err;

            const arr = JSON.parse(data);
            arr.push(logs);

            fs.writeFileSync("arbProfitLogs.json", JSON.stringify(arr), (err) => {
                if (err) throw err;
            });
        });
    } else {
        console.log("Pool address array lengths don't match");
    }
    console.log("///////////////////////////////////////////////////////////////////////////////", time);
}

setInterval(() => {
    arbitrageProfitLogger();
}, 10000);

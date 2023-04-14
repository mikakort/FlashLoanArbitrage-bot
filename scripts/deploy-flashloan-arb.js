const hre = require("hardhat");
const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

async function main() {
    let arguments = [
        "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e", // Aave flash loan pool  mainnet: 0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // weth mainnet: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
        "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDC  mainnet: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48  USDT mainnet: 0xdAC17F958D2ee523a2206206994597C13D831ec7
        "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46", // Curve swap mock mainnet: 0xD51a44d3FaE010294C616388b506AcdA1bfAAE46
        "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap SwapRouter mainnet: 0xE592427A0AEce92De3Edee1F18E0157C05861564
    ];

    const FlashLoanARB = await hre.ethers.getContractFactory("FlashLoanArbitrage");
    const flashLoanARB = await FlashLoanARB.deploy(...arguments);

    await flashLoanARB.deployed();
    console.log(`Flash loan contract deployed at: ${flashLoanARB.address}`);

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        console.log("Verifying...");
        await verify(flashLoanARB.address, arguments);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

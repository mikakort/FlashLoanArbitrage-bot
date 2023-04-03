const hre = require("hardhat");
const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

async function main() {
    let arguments = [
        "0xC911B590248d127aD18546B186cC6B324e99F02c", // Aave flash loan pool
        "0x65aFADD39029741B3b8f0756952C74678c9cEC93", // USDC
        "0x75Ab5AB1Eef154C0352Fc31D2428Cef80C7F8B33", // DAI
        "0xe85abCf0F60Bc8E079Bc6184c6a6A989FBc532C1", // Curve swap mock
        "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap SwapRouter
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

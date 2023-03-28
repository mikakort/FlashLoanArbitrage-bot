const hre = require("hardhat");
const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

async function main() {
    let arguments = [
        "0xC911B590248d127aD18546B186cC6B324e99F02c", // Aave flash loan pool
        "0x65aFADD39029741B3b8f0756952C74678c9cEC93", // USDC
        "0x75Ab5AB1Eef154C0352Fc31D2428Cef80C7F8B33", // WETH
        "0xe85abCf0F60Bc8E079Bc6184c6a6A989FBc532C1", // Curve swap mock
        "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap SwapRouter
        "0xAb5c49580294Aff77670F839ea425f5b78ab3Ae7", // PriceFeed USDC/USD: 0xfe4a8cc5b5b2366c1b58bea3858e81843581b2f7  ETH/USD: 0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e
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

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

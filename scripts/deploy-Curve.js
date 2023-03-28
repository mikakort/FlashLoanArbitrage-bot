const hre = require("hardhat");
const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

async function main() {
    const tokenSwap = await hre.ethers.getContractFactory("TokenSwap");
    const _tokenSwap = await tokenSwap.deploy();

    await _tokenSwap.deployed();
    console.log(`Curve contract deployed at: ${_tokenSwap.address}`);

    arguments = [];
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        console.log("Verifying...");
        await verify(_tokenSwap.address, arguments);
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

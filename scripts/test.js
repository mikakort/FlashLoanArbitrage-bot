const { ethers } = require("hardhat");

async function test() {
    const address = "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46";
    const ABI = require("./ABIS/CurvePool")[1]; // I have an array of ABIs
    const signer = await ethers.getSigner();

    const poolContract_Curve = new ethers.Contract(address, ABI, signer);
    const dy = await poolContract_Curve.get_dy(2, 0, 1000000000000);
    console.log(dy);
}

test();

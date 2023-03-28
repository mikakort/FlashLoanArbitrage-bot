const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { assert, expect } = require("chai");
const { getNamedAccounts, ethers, network } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Flash Loan Arbitrage tests", function () {
          let flashLoanContract, deployer;

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              flashLoanContract = await ethers.getContractAt("FlashLoanArbitrage", deployer);
          });
          describe("Constructor", () => {
              it("Inits correctly", async function () {
                  const token0 = await flashLoanContract.getToken0();
                  const token1 = await flashLoanContract.getToken1();

                  assert.equal(token0.toString(), "");
                  assert.equal(token1.toString(), "");
                  assert.notEqual(token0, token1);
              });
          });
      });

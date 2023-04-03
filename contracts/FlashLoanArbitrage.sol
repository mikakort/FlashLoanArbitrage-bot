// contracts/FlashLoan.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {FlashLoanSimpleReceiverBase} from "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

interface ICurvePool {
    function exchange(uint128 i, uint128 j, uint256 dx, uint256 dy, bool use_eth) external;
}

contract FlashLoanArbitrage is FlashLoanSimpleReceiverBase {
    address payable owner;
    ISwapRouter public immutable swapRouter;
    address public immutable curveRouter;

    address public token0;
    address public token1;

    constructor(
        address _addressProvider,
        address _token0,
        address _token1,
        address _curvePoolAddress,
        ISwapRouter _swapRouter
    ) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) {
        owner = payable(msg.sender);
        swapRouter = _swapRouter;
        curveRouter = _curvePoolAddress;

        token0 = _token0;
        token1 = _token1;
    }

    function swapExactInputSingle(
        uint256 amountIn,
        address _token0,
        address _token1
    ) internal returns (uint256 amountOut) {
        TransferHelper.safeApprove(_token0, address(swapRouter), amountIn);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: _token0,
            tokenOut: _token1,
            fee: 3000,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        amountOut = swapRouter.exactInputSingle(params);
    }

    function swapOnCurve(
        address _token0,
        address _token1,
        uint256 _amount,
        bool normal
    ) internal returns (uint256) {
        IERC20(_token0).approve(curveRouter, _amount);
        if (normal) {
            ICurvePool(curveRouter).exchange(1, 0, _amount, 0, false);
        } else if (!normal) {
            ICurvePool(curveRouter).exchange(0, 1, _amount, 0, false);
        }

        return IERC20(_token1).balanceOf(address(this));
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        uint256 amountOut;

        if (asset == token0) {
            amountOut = swapExactInputSingle(amount, token0, token1);

            swapOnCurve(token1, token0, amountOut, true);
        } else if (asset == token1) {
            amountOut = swapExactInputSingle(amount, token1, token0);

            swapOnCurve(token0, token1, amountOut, false);
        } else {
            revert("borrowed asset doesn't match arbitrage asset");
        }

        uint256 amountOwed = amount + premium;
        require(IERC20(asset).balanceOf(address(this)) >= amountOwed, "not profitable");
        IERC20(asset).approve(address(POOL), amountOwed);

        return true;
    }

    function requestFlashLoan(address _token, uint256 _amount) public {
        address receiverAddress = address(this);
        address asset = _token;
        uint256 amount = _amount;
        bytes memory params = "";
        uint16 referralCode = 0;

        POOL.flashLoanSimple(receiverAddress, asset, amount, params, referralCode);
    }

    function withdraw(address _tokenAddress) external onlyOwner {
        IERC20 token = IERC20(_tokenAddress);
        token.transfer(msg.sender, token.balanceOf(address(this)));
    }

    function changeToken0(address _tokenAddress) external onlyOwner {
        token0 = _tokenAddress;
    }

    function changeToken1(address _tokenAddress) external onlyOwner {
        token1 = _tokenAddress;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the contract owner can call this function");
        _;
    }
}

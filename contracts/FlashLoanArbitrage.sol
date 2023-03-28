// contracts/FlashLoan.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;
pragma abicoder v2;

import {FlashLoanSimpleReceiverBase} from "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

// Import Dex interfaces

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

// Importing Curve's tricrypto interface
interface ICurvePool {
    function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external;
}

contract FlashLoanArbitrage is FlashLoanSimpleReceiverBase {
    // DECLARING VARIABLES
    address payable owner;
    ISwapRouter public immutable swapRouter;
    address public immutable curveRouter;

    address public token0; // USDT
    address public token1; // WETH
    uint24 public constant poolFee = 3000;

    AggregatorV3Interface public priceFeed;

    // CONSTRUCTOR

    constructor(
        address _addressProvider,
        address _token0,
        address _token1,
        address _curvePoolAddress,
        ISwapRouter _swapRouter,
        address _priceFeed
    ) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) {
        owner = payable(msg.sender);
        swapRouter = _swapRouter;
        curveRouter = _curvePoolAddress;

        token0 = _token0;
        token1 = _token1;

        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    // PRICE FEED

    function getLatestPrice() internal view returns (uint256) {
        // prettier-ignore
        (
            /* uint80 roundID */,
            int256 price,
            /*uint startedAt*/,
            /*uint timeStamp*/,
            /*uint80 answeredInRound*/
        ) = priceFeed.latestRoundData();
        return uint(price / 1e8);
    }

    // DECLARING SWAPPING FUNCTIONS

    // UNISWAP:

    /// @notice swapExactInputSingle swaps a fixed amount of token0 for a maximum possible amount of token1
    /// using the token0/token1 0.3% pool by calling `exactInputSingle` in the swap router.
    /// @dev The calling address must approve this contract to spend at least `amountIn` worth of its token0 for this function to succeed.
    /// @param amountIn The exact amount of token0 that will be swapped for token1.
    /// @return amountOut The amount of token1 received.
    function swapExactInputSingle(
        uint256 amountIn,
        address _token0,
        address _token1,
        bool normal
    ) internal returns (uint256 amountOut) {
        // Approve the router to spend token0.
        TransferHelper.safeApprove(_token0, address(swapRouter), amountIn);
        // Naively set amountOutMinimum to 0. In production, use an oracle or other data source to choose a safer value for amountOutMinimum.
        // We also set the sqrtPriceLimitx96 to be 0 to ensure we swap our exact input amount.
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: _token0,
            tokenOut: _token1,
            fee: poolFee,
            recipient: msg.sender,
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: 0, // CHANGE MIN TO AVOID LOSS   actually 0 is fine when doing it through the router
            sqrtPriceLimitX96: 0 // 96 byte precision
        });

        // The call to `exactInputSingle` executes the swap.
        amountOut = swapRouter.exactInputSingle(params);
    }

    // CURVEFINANCE:
    function swapOnCurve(
        uint256 _amount,
        address _token0, // WETH
        address _token1, // USDT
        bool normal
    ) internal returns (uint256) {
        // Approving Curve pool to spend TOKEN0
        IERC20(_token0).approve(curveRouter, _amount);
        // Calling exchange function with i = 0 (TOKEN0), j = 2 (TOKEN1), dx = _amount, and min_dy = 0
        if (normal) {
            ICurvePool(curveRouter).exchange(
            1,
            0,
            _amount,
            normal ? _amount * getLatestPrice() : _amount / getLatestPrice()
        ); // CHANGE MIN TO AVOID LOSS
        } else if (!normal) {
            ICurvePool(curveRouter).exchange(
            0,
            1,
            _amount,
            normal ? _amount * getLatestPrice() : _amount / getLatestPrice()
        ); // CHANGE MIN TO AVOID LOSS
        }
        

        // no need to transfer since contract is the caller of the func

        return IERC20(_token1).balanceOf(address(this));
    }

    /**
        This function is called after your contract has received the flash loaned amount
     */
    function executeOperation(
        // override of aave interface execute op.
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        //
        // This contract now has the funds requested.
        // logic goes here.
        //

        // Arbirtage operation

        // 1. swap token0 for token 1 in uniswap and swap back from 1 to 0 in curve and pay back loan
        if (asset == token0) {
            swapExactInputSingle(IERC20(token0).balanceOf(address(this)), token0, token1, true);

            swapOnCurve(IERC20(token1).balanceOf(address(this)), token1, token0, true);
        } else if (asset == token1) {
            swapExactInputSingle(IERC20(token1).balanceOf(address(this)), token1, token0, false);

            swapOnCurve(IERC20(token0).balanceOf(address(this)), token0, token1, false);
        } else {
            revert("borrowed asset doesn't match arbitrage asset");
        }

        // abstract the decision to http request?

        // At the end of your logic above, this contract owes
        // the flashloaned amount + premiums.
        // Therefore ensure your contract has enough to repay
        // these amounts.

        // Approve the Pool contract allowance to *pull* the owed amount
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

    function getBalance(address _tokenAddress) external view returns (uint256) {
        return IERC20(_tokenAddress).balanceOf(address(this));
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

    function changePriceFeed(address _oracle) external onlyOwner {
        priceFeed = AggregatorV3Interface(_oracle);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the contract owner can call this function");
        _;
    }

    receive() external payable {}
}

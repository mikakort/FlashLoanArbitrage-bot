// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// DONE

contract TokenSwap is Ownable {
    uint128 public constant N_COINS = 3;
    // uint256 public constant PRECISION = 10**18; probably not needed
    address[N_COINS] tokens = [
        0x65aFADD39029741B3b8f0756952C74678c9cEC93, // USDC
        0x75Ab5AB1Eef154C0352Fc31D2428Cef80C7F8B33, // DAI
        0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6 // WETH
    ];

    // The fixed rate of conversion from tokenA to tokenB
    uint256 public rate = 1;

    // The event to be emitted when a swap occurs
    event Swap(address indexed user, uint256 dx, uint256 amountB);

    // The function that allows the owner to change the rate
    function setRate(uint256 _rate) external onlyOwner {
        rate = _rate;
    }

    function allowance(address _token) external view returns (uint256) {
        return IERC20(_token).allowance(owner(), address(this));
    }

    function approve(uint256 amount, uint128 _token) public returns (bool) {
        IERC20(tokens[_token]).approve(address(this), amount);
    }

    // The function that allows a user to swap tokenA for tokenB
    function exchange(uint128 i, uint128 j, uint256 dx, uint256 dy, bool use_eth) external {
        // mocking curve kinda
        require(i < N_COINS && j < N_COINS, "Out of bounds");
        IERC20 tokenA = IERC20(tokens[i]);
        IERC20 tokenB = IERC20(tokens[j]);

        require(dx > 0, "Amount must be positive");
        require(tokenA.balanceOf(msg.sender) >= dx, "Insufficient balance of tokenA");
        require(
            tokenA.allowance(msg.sender, address(this)) >= dx,
            "Insufficient allowance of tokenA"
        );

        // Calculate the amount of tokenB to be received
        uint256 amountB = (i != 0) ? (dx / (10 ** 12)) * rate : dx * (10 ** 12) * rate;

        // Check that the contract has enough balance of tokenB
        require(tokenB.balanceOf(address(this)) >= amountB, "Insufficient balance of tokenB");

        // Transfer tokenA from the user to the contract
        tokenA.transferFrom(msg.sender, address(this), dx);

        // Transfer tokenB from the contract to the user
        tokenB.transfer(msg.sender, amountB);

        // Emit the swap event
        emit Swap(msg.sender, dx, amountB);
    }

    function withdraw(address _token) external {
        IERC20(_token).transfer(msg.sender, IERC20(_token).balanceOf(address(this)));
    }

    function getToken(uint128 i) public view returns (address) {
        return tokens[i];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

//import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract CloudMining is ERC20, Ownable {
    using SafeMath for uint;
    using SafeERC20 for ERC20;

    // Addresses of all contracts which was ever mined
    address[] public minedTokens;
    mapping (address => bool) public minedTokensMap;

    // The previous contract's balance of mined tokens
    mapping (address => uint) public minedTokensPreviousBalance;

    // Array of all investors addresses
    address[] public investors;

    // Keeps investors balances divided by mined token address
    // investorRewardByMinedToken = investorsRewards[minedTokenAddress][investorAddress]
    mapping (address => mapping (address => uint)) public investorsRewards;

    // Address of USDT token to buy ours
    address public tetherToken;

    // Minimal amount of our tokens investor can buy
    uint public minAmount;

    // Current price of our token in USDT
    uint public price;

    // Owner's commission
    uint8 public fee;


    constructor(uint _minAmount, uint _price, uint8 _fee, address _tetherToken) ERC20("CloudMining", "CLM") {
        tetherToken = _tetherToken;
        setParams(_minAmount, _price, _fee);
    }


    function getSummary() public view returns (
        uint, uint, uint8, address, address, uint
    ) {
        return (
            minAmount,
            price,
            fee,
            tetherToken,
            owner(),
            investors.length
        );
    }


    function setParams(uint _minAmount, uint _price, uint8 _fee) public onlyOwner {
        // Ensure transparency by hardcoding limit beyond which fees can never be added
        require(_fee <= 50);

        minAmount = _minAmount;
        price = _price;
        fee = _fee;

        emit SetParams(minAmount, price, fee);
    }


    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }


    function enter(uint tokensAmount) public {
        require(tokensAmount >= minAmount);

        uint tetherAmount = tokensAmount.mul(price).div(10**18);
        // console.log("enter: Investor wants to buy %s tokens with price %s USDT. The cost will be %s", tokensAmount, price, tetherAmount);

        require(balanceOf(address(this)) >= tokensAmount);
        // console.log("enter: Contract still has %s tokens", balanceOf(address(this)));

        ERC20 usdt = ERC20(tetherToken);
        // console.log("enter: USDT allowance is %s", usdt.allowance(_msgSender(), address(this)));

        // console.log("enter: USDT balance of owner is %s (before)", usdt.balanceOf(owner()));
        usdt.safeTransferFrom(_msgSender(), owner(), tetherAmount);
        // console.log("enter: USDT balance of owner is %s (after)", usdt.balanceOf(owner()));

        ERC20(address(this)).safeTransfer(_msgSender(), tokensAmount);
        // console.log("enter: Investor's balance is now: %s tokens", balanceOf(_msgSender()));

        // console.log("");
    }


    // Called when new investor enters of when existing investor transfers his tokens to somebody
    function _afterTokenTransfer(address from, address to, uint256 amount) internal override {
        bool wasAnExistingInvestor = balanceOf(to) > amount;
        if (!wasAnExistingInvestor && to != owner() && to != address(this)) {
            investors.push(to);
        }
    }


    function getInvestorBalance(address investorAddress, address minedTokenAddress) public view returns (uint) {
        return investorsRewards[minedTokenAddress][investorAddress];
    }


    function distribute(address minedTokenAddress) public {
        // Get mined amount
        ERC20 minedToken = ERC20(minedTokenAddress);
        uint currentBalance = minedToken.balanceOf(address(this));
        uint previousBalance = minedTokensPreviousBalance[minedTokenAddress];
        uint minedAmount = currentBalance.sub(previousBalance);
        // console.log("distribute: Mined %s wei. As the last balance was %s and the current is %s", minedAmount, previousBalance, currentBalance);

        if (minedAmount == 0) {
            // console.log("distribute: Nothing mined, exiting");
            return;
        }

        // If it's the very first time we mine that token - add it to the list of mined tokens
        if (minedTokensMap[minedTokenAddress] == false) {
            minedTokensMap[minedTokenAddress] = true;
            minedTokens.push(minedTokenAddress);
        }

        // Update previous balance
        minedTokensPreviousBalance[minedTokenAddress] = currentBalance;

        // The rest of amount should finally go to the owner
        uint minedAmountRemainder = minedAmount;

        // For each investor - calculate its reward and transfer
        uint i;
        uint totalSupply = totalSupply();
        // console.log("distribute: Total supply is %s", totalSupply);

        for (i = 0; i < investors.length; i++) {
            address investorAddress = investors[i];

            uint investorBalance = balanceOf(investorAddress);
            if (investorBalance == 0) {
                continue;
            }

            uint investorReward = minedAmount.mul(investorBalance).div(totalSupply);
            uint commission = investorReward.mul(fee).div(100);

            investorReward = investorReward.sub(commission);
            minedAmountRemainder = minedAmountRemainder.sub(investorReward);

            // Store updated investor balance
            investorsRewards[minedTokenAddress][investorAddress] = investorsRewards[minedTokenAddress][investorAddress].add(investorReward);

            // Debugging lines
            // uint investorMinedTokenBalance = investorsRewards[minedTokenAddress][investorAddress];
            // console.log("distribute: Investor %s has %s tokens out of %s total supply:", investorAddress, investorBalance, totalSupply);
            // console.log("distribute:   - his reward is %s wei and new balance is %s", investorReward, investorMinedTokenBalance);
            // console.log("distribute:   - owner's commission is %s", commission);

            emit Distribute(investorAddress, minedTokenAddress, investorReward);
        }

        // Store owner's reward
        investorsRewards[minedTokenAddress][owner()] += minedAmountRemainder;
        emit Distribute(owner(), minedTokenAddress, minedAmountRemainder);
        // console.log("distribute: Owner remainder: %s. New owner balance is: %s", minedAmountRemainder, investorsRewards[minedTokenAddress][owner()]);
        // console.log("");
    }


    /**
     * Transfers investor's balance of desired tokens to him
     */
    function withdraw(address minedTokenAddress) public {
        _withdraw(minedTokenAddress, _msgSender());
    }


    /**
     * Transfers all investors' balances of desired tokens to them
     * Then gets the rest of contract's balances and transfers them to owner
     */
    function withdrawAll() public onlyOwner {
        uint i;
        uint j;

        for (j = 0; j < minedTokens.length; j++) {
            address minedTokenAddress = minedTokens[j];

            for (i = 0; i < investors.length; i++) {
                address investorAddress = investors[i];
                _withdraw(minedTokenAddress, investorAddress);
            }

            _withdrawRest(minedTokenAddress);
        }
    }


    function _withdrawRest(address minedTokenAddress) internal {
        ERC20 minedToken = ERC20(minedTokenAddress);
        uint currentBalance = minedToken.balanceOf(address(this));
        // console.log("_withdrawRest: Contract's balance of token %s is %s", minedTokenAddress, currentBalance);

        minedToken.safeTransfer(owner(), currentBalance);

        investorsRewards[minedTokenAddress][owner()] = 0;
        minedTokensPreviousBalance[minedTokenAddress] = 0;

        emit Withdraw(owner(), minedTokenAddress, currentBalance);
    }


    function _withdraw(address minedTokenAddress, address investorAddress) internal {
        uint investorReward = investorsRewards[minedTokenAddress][investorAddress];
        // console.log("_withdraw: token %s, investor %s balance is %s", minedTokenAddress, investorAddress, investorReward);
        
        if (investorReward == 0) {
            // console.log("_withdraw: Nothing to withdraw, exiting");
            return;
        }

        ERC20 minedToken = ERC20(minedTokenAddress);
        minedToken.safeTransfer(investorAddress, investorReward);

        // Flush investor's balance
        investorsRewards[minedTokenAddress][investorAddress] = 0;

        // Decrease mined token previous balance by the sum of withdrawal
        minedTokensPreviousBalance[minedTokenAddress] -= investorReward;

        emit Withdraw(investorAddress, minedTokenAddress, investorReward);
    }
    

    event SetParams(uint _minAmount, uint _price, uint8 _fee);
    event Distribute(address _investorAddress, address _minedTokenAddress, uint _investorReward);
    event Withdraw(address _investorAddress, address _minedTokenAddress, uint _amount);
}
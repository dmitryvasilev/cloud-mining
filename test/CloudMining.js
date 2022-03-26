const BN = require("bn.js");
const { assert } = require("chai");
const { ethers } = require("hardhat");
const { extendEnvironment } = require("hardhat/config");

const CloudMining = artifacts.require("CloudMining");
const TetherToken = artifacts.require("TetherToken");

const richDeposit = getWei('10000');
const poorDeposit = getWei('10');
const supportiveTokensMintAmount = getWei('1000000');

let cloudMining, tetherToken, ethToken, btcToken;
let accountOwner, accountPool, accountHolder1, accountHolder2, accountHolder3;

let initialMint = getWei('50');
let initialMinAmount = getWei('1');
let initialPrice = getWei('15');
let initialFee = 20;


beforeEach(async () => {
    [accountOwner, accountPool, accountHolder1, accountHolder2, accountHolder3, accountHolder4] = await web3.eth.getAccounts();
    
    // Instanciate contracts
    ethToken = await TetherToken.new(supportiveTokensMintAmount, 'ETHToken', 'ETH', 18);
    btcToken = await TetherToken.new(supportiveTokensMintAmount, 'BTCToken', 'BTC', 18);
    tetherToken = await TetherToken.new(supportiveTokensMintAmount, 'TetherToken', 'USDT', 18);
    
    cloudMining = await CloudMining.new(initialMinAmount, initialFee);
    await cloudMining.setPrice(tetherToken.address, initialPrice);

    // Mint CloudMining tokens to the contract itself
    await cloudMining.mint(cloudMining.address, initialMint);

    // As USDT creator: Give USDT to account holders
    await tetherToken.transfer(accountHolder1, richDeposit);
    await tetherToken.transfer(accountHolder2, richDeposit);
    await tetherToken.transfer(accountHolder3, richDeposit);

    // Give a very small USDT amount to the fourth account holder
    await tetherToken.transfer(accountHolder4, poorDeposit);
});


describe('Supportive tokens', async () => {
    it('all tokens deployed', async () => {
        assert.ok(ethToken.address);
        assert.ok(btcToken.address);
        assert.ok(tetherToken.address);
    });

    it('initial balances of USDT are correctly set', async () => {
        assert.equal(await tetherToken.balanceOf(cloudMining.address), 0);
        assert.equal(await tetherToken.balanceOf(accountHolder1), richDeposit.toString());
        assert.equal(await tetherToken.balanceOf(accountHolder2), richDeposit.toString());
        assert.equal(await tetherToken.balanceOf(accountHolder3), richDeposit.toString());
        assert.equal(await tetherToken.balanceOf(accountHolder4), poorDeposit.toString());
    });
});


describe('CloudMining Administrator', async () => {
    it('can deploy a contract', () => {
        assert.ok(cloudMining.address);
    });

    it('variables initialized correctly', async () => {
        assert.equal(await cloudMining.minAmount(), initialMinAmount.toString());
        assert.equal(await cloudMining.fee(), initialFee.toString());
        assert.equal(await cloudMining.price(tetherToken.address), initialPrice.toString());
        assert.equal(await cloudMining.priceTokens(0), tetherToken.address);
    });

    it('getSummary() works correctly', async () => {
        await buyCloudMining(accountHolder1, initialMinAmount.mul(new BN('1')));
        await buyCloudMining(accountHolder2, initialMinAmount.mul(new BN('2')));
        await buyCloudMining(accountHolder3, initialMinAmount.mul(new BN('3')));

        let summary = await cloudMining.getSummary();
        assert.equal(summary[0], initialMinAmount.toString());
        assert.equal(summary[1], initialFee.toString());
        assert.equal(summary[2], accountOwner);
        assert.equal(summary[3], 3); // Number of investors
    });

    it('becomes a contract owner', async () => {
        let owner = await cloudMining.owner();
        assert.equal(owner, accountOwner);
    });

    it('can change initial params', async () => {
        await cloudMining.setParams(initialMinAmount + 11, initialFee + 12);
        assert.equal(await cloudMining.minAmount(), initialMinAmount + 11);
        assert.equal(await cloudMining.fee(), initialFee + 12);
    });

    it('can change price', async () => {
        await cloudMining.setPrice(tetherToken.address, initialPrice + 10);
        await cloudMining.setPrice(tetherToken.address, initialPrice + 10); // Shouldn't create a duplicate
        assert.equal((await cloudMining.getPriceTokens()).length, 1);

        await cloudMining.setPrice(btcToken.address, initialPrice + 11);
        assert.equal((await cloudMining.getPriceTokens()).length, 2);

        assert.equal(await cloudMining.price(tetherToken.address), initialPrice + 10);
        assert.equal(await cloudMining.price(btcToken.address), initialPrice + 11);
    });

    it('can\'t set invalid price', async () => {
        await assertTxFails(async () => {
            await cloudMining.setPrice(tetherToken.address, 0);
        }, "Invalid price given");
    });

    it('can set second price and use it for purchase', async () => {
        let priceInBTC = getWei('0.05');

        await cloudMining.setPrice(btcToken.address, priceInBTC);

        // USDT price remains untouchable
        assert.equal((await cloudMining.price(tetherToken.address)).toString(), initialPrice.toString());

        // BTC price was set correctly
        assert.equal((await cloudMining.price(btcToken.address)).toString(), priceInBTC.toString());
        assert.equal(await cloudMining.priceTokens(1), btcToken.address);

        // Load account1 with test BTC
        await btcToken.transfer(accountHolder1, priceInBTC);

        // Check investor can buy and then owner's balance increased
        let balanceBefore = await btcToken.balanceOf(accountOwner);
        await buyCloudMining(accountHolder1, initialMinAmount, btcToken);
        let balanceAfter = await btcToken.balanceOf(accountOwner);

        let actualBalance = new BN(balanceAfter).sub(balanceBefore).toString();
        let expectedBalance = initialMinAmount.mul(priceInBTC).div(new BN(''+10**18));

        assert.equal(actualBalance.toString(), expectedBalance.toString());
    });

    it('fee can not be greater than 50%', async () => {
        await assertTxFails(async () => {
            await cloudMining.methods["setParams(uint256,uint8)"](1, 51, { from: accountOwner });
        }, "Fee can't be greated than 50%");
    });

    it('sensitive methods can be called only by creator', async () => {
        await assertTxFails(async () => {
            await cloudMining.methods["setParams(uint256,uint8)"](1, 2, { from: accountHolder1 });
        }, "Ownable: caller is not the owner");
    });
    
    it('gets USDT when somebody buys tokens', async () => {
        let balanceBefore = await tetherToken.balanceOf(accountOwner);

        await buyCloudMining(accountHolder1, initialMinAmount.mul(new BN('1')));
        await buyCloudMining(accountHolder2, initialMinAmount.mul(new BN('2')));
        await buyCloudMining(accountHolder3, initialMinAmount.mul(new BN('3')));

        let balanceAfter = await tetherToken.balanceOf(accountOwner);

        // Assert owner now has USDT
        let expectedBalance = initialMinAmount.mul(new BN('6')).mul(new BN(initialPrice)).div(new BN(''+10**18)).toString();
        let actualBalance = new BN(balanceAfter).sub(balanceBefore).toString();

        assert.equal(actualBalance, expectedBalance);
    });
    
    it('can mint more', async () => {
        let mintedBefore = await cloudMining.totalSupply();
        await cloudMining.mint(cloudMining.address, getWei('10'));
        let mintedAfter = await cloudMining.totalSupply();

        assert.equal(mintedAfter - mintedBefore, getWei('10'));
    });
});


describe('CloudMining Investor entrance', async () => {
    it('can buy and become an investor', async () => {
        let amount = initialMinAmount.mul(new BN('2'));
        
        let balanceBefore = await cloudMining.balanceOf(accountHolder1);
        await buyCloudMining(accountHolder1, amount);
        let balanceAfter = await cloudMining.balanceOf(accountHolder1);
        
        assert.equal(balanceAfter - balanceBefore, amount);
    });

    it('can\'t buy without the price set', async () => {
        await assertTxFails(async () => {
            await buyCloudMining(accountHolder1, initialMinAmount, btcToken);
        }, "No price for given token");
    });

    it('have to make at least minimal investment', async () => {
        await assertTxFails(async () => {
            await buyCloudMining(accountHolder1, initialMinAmount.sub(new BN('1')));
        }, "Min amount requirement failed");
    });

    it('can buy more', async () => {
        let balanceBefore = await cloudMining.balanceOf(accountHolder1);

        await buyCloudMining(accountHolder1, initialMinAmount);
        await buyCloudMining(accountHolder1, initialMinAmount);

        let balanceAfter = await cloudMining.balanceOf(accountHolder1);
        assert.equal(balanceAfter - balanceBefore, initialMinAmount.mul(new BN('2')));
    });

    it('can\'t buy having insufficient USDT', async () => {
        await assertTxFails(async () => {
            await buyCloudMining(accountHolder4, initialMinAmount.mul(new BN('2')));
        }, "SafeERC20: low-level call failed");
    });

    it('can\'t buy more tokens than contract has left', async () => {
        await buyCloudMining(accountHolder1, initialMinAmount);
        await buyCloudMining(accountHolder2, initialMint.sub(initialMinAmount));

        await assertTxFails(async () => {
           await buyCloudMining(accountHolder3, initialMinAmount);
        }, "No tokens left");
    });
});


describe('CloudMining Investor rewarding', async () => {
    it("transferToCloudMining helpers works correcly", async () => {
        await transferToCloudMining(ethToken, getWei('0.1'));
        await transferToCloudMining(ethToken, getWei('0.2'));

        await transferToCloudMining(btcToken, getWei('1'));
        await transferToCloudMining(btcToken, getWei('2'));

        assert.equal(await ethToken.balanceOf(cloudMining.address), getWei('0.3').toString());
        assert.equal(await btcToken.balanceOf(cloudMining.address), getWei('3').toString());
    });

    it('ever mined tokens saves correctly', async () => {
        await transferToCloudMining(ethToken, getWei('0.1'));
        await transferToCloudMining(btcToken, getWei('1'));

        await cloudMining.distribute(ethToken.address);
        await cloudMining.distribute(ethToken.address); // Should not create a duplicate in a contract's variable
        await cloudMining.distribute(tetherToken.address); // Should not appear because our contract has zero balance in it
        await cloudMining.distribute(btcToken.address);

        assert.equal(await cloudMining.minedTokens(0), ethToken.address);
        assert.equal(await cloudMining.minedTokens(1), btcToken.address);
    });

    it('when nothing is mined it\'s still working', async () => {
        await cloudMining.distribute(btcToken.address);
    });

    it("mined amount calculates corretly", async () => {
        await transferToCloudMining(ethToken, getWei('0.1'));
        await transferToCloudMining(ethToken, getWei('0.2'));
        await transferToCloudMining(btcToken, getWei('1'));

        await cloudMining.distribute(ethToken.address);
        await cloudMining.distribute(btcToken.address);

        assert.equal((await cloudMining.getInvestorBalance(accountOwner, ethToken.address)).toString(), getWei('0.3'));
        assert.equal((await cloudMining.getInvestorBalance(accountOwner, btcToken.address)).toString(), getWei('1'));
    });

    // According to test case: https://docs.google.com/spreadsheets/d/1hZivEsP4b2RT_avWxKxebXD6AW-veAqaDJQar1e_WFE/edit#gid=2121616660
    it('end-to-end test', async () => {
        let initialOwnerBalance, currentOwnerBalance;

        // Day 1
        await buyCloudMining(accountHolder1, getWei('1'));
        await transferToCloudMining(ethToken, getWei('0.5'));
        await cloudMining.distribute(ethToken.address);
        assert.equal(await cloudMining.getInvestorBalance(accountHolder1, ethToken.address), getWei('0.008').toString());
        assert.equal(await cloudMining.getInvestorBalance(accountOwner, ethToken.address), getWei('0.492').toString());

        // Day 2
        await cloudMining.mint(cloudMining.address, getWei('50'));
        await transferToCloudMining(ethToken, getWei('0.25'));
        await transferToCloudMining(ethToken, getWei('0.25')); // Shouldn't break anything (totally mined 0.5 ETH)
        await cloudMining.distribute(ethToken.address);
        await cloudMining.distribute(ethToken.address); // Shouldn't break anything
        assert.equal(await cloudMining.getInvestorBalance(accountHolder1, ethToken.address), getWei('0.012').toString());
        assert.equal(await cloudMining.getInvestorBalance(accountOwner, ethToken.address), getWei('0.988').toString());

        // Day 3 - Withdrawal test
        await buyCloudMining(accountHolder1, getWei('20'));
        await transferToCloudMining(ethToken, getWei('1'));
        await cloudMining.distribute(ethToken.address);
        assert.equal(await cloudMining.getInvestorBalance(accountHolder1, ethToken.address), getWei('0.18').toString());
        assert.equal(await cloudMining.getInvestorBalance(accountOwner, ethToken.address), getWei('1.82').toString());

        initialOwnerBalance = await ethToken.balanceOf(accountOwner);
        await cloudMining.withdrawAll();
        await cloudMining.withdrawAll(); // Shouldn't break anything
        currentOwnerBalance = await ethToken.balanceOf(accountOwner);
        currentOwnerBalance = currentOwnerBalance.sub(initialOwnerBalance);

        assert.equal(await cloudMining.getInvestorBalance(accountHolder1, ethToken.address), 0);
        assert.equal(await cloudMining.getInvestorBalance(accountOwner, ethToken.address), 0);
        assert.equal((await ethToken.balanceOf(accountHolder1)).toString(), getWei('0.18').toString());
        assert.equal(currentOwnerBalance.toString(), getWei('1.82').toString());

        // Day 4 - works properly after withdrawal
        await transferToCloudMining(ethToken, getWei('0.25'));
        await cloudMining.distribute(ethToken.address);
        assert.equal(await cloudMining.getInvestorBalance(accountHolder1, ethToken.address), getWei('0.042').toString());
        assert.equal(await cloudMining.getInvestorBalance(accountOwner, ethToken.address), getWei('0.208').toString());

        // Day 5 - investor withdraws his funds
        await transferToCloudMining(ethToken, getWei('1'));
        await cloudMining.distribute(ethToken.address);
        assert.equal(await cloudMining.getInvestorBalance(accountHolder1, ethToken.address), getWei('0.21').toString());
        assert.equal(await cloudMining.getInvestorBalance(accountOwner, ethToken.address), getWei('1.04').toString());

        initialOwnerBalance = await ethToken.balanceOf(accountOwner);
        await cloudMining.methods["withdraw(address)"](ethToken.address, { from: accountHolder1 });
        await cloudMining.methods["withdraw(address)"](ethToken.address, { from: accountHolder1 }); // Shouldn't break anything
        currentOwnerBalance = await ethToken.balanceOf(accountOwner);
        currentOwnerBalance = currentOwnerBalance.sub(initialOwnerBalance);

        let expectedAccountHolder1Balance = "" + (0.18 + 0.21);
        assert.equal((await ethToken.balanceOf(accountHolder1)).toString(), getWei(expectedAccountHolder1Balance).toString());
        assert.equal(currentOwnerBalance.toString(), 0);
    });

    it('transactions costs test', async () => {
        printTransactionCost(await cloudMining.distribute(ethToken.address), 'distribute nothing');

        printTransactionCost(await buyCloudMining(accountHolder1, getWei('1')), 'enter first investor');
        await transferToCloudMining(ethToken, getWei('1'));
        printTransactionCost(await cloudMining.distribute(ethToken.address), 'distribute to one investor');

        printTransactionCost(await buyCloudMining(accountHolder2, getWei('1')), 'enter second investor');
        await transferToCloudMining(ethToken, getWei('1'));
        printTransactionCost(await cloudMining.distribute(ethToken.address), 'distribute to two investors');

        printTransactionCost(await buyCloudMining(accountHolder3, getWei('1')), 'enter third investor');
        await transferToCloudMining(ethToken, getWei('1'));
        printTransactionCost(await cloudMining.distribute(ethToken.address), 'distribute to three investors');

        printTransactionCost(await cloudMining.methods["withdraw(address)"](ethToken.address, { from: accountHolder1 }), 'withdraw to one investor');
        printTransactionCost(await cloudMining.withdrawAll(), 'withdraw to all investors');
    });

});


describe('CloudMining ERC20 transfers', async () => {
    it('new investor appears', async () => {
        await buyCloudMining(accountHolder1, initialMinAmount.mul(new BN('3')));
        await cloudMining.methods["transfer(address,uint256)"](accountHolder2, initialMinAmount, { from: accountHolder1 });

        assert.equal(await cloudMining.investors(0), accountHolder1);
        assert.equal(await cloudMining.investors(1), accountHolder2);
    });

    it('distribute() and withdrawAll() methods acts correctly', async () => {
        await buyCloudMining(accountHolder1, initialMinAmount.mul(new BN('3')));
        await cloudMining.methods["transfer(address,uint256)"](accountHolder2, initialMinAmount, { from: accountHolder1 });

        await transferToCloudMining(ethToken, getWei('1'));
        await cloudMining.distribute(ethToken.address);

        assert.equal((await cloudMining.getInvestorBalance(accountHolder1, ethToken.address)).toString(), getWei('0.032').toString());
        assert.equal((await cloudMining.getInvestorBalance(accountHolder2, ethToken.address)).toString(), getWei('0.016').toString());

        await cloudMining.withdrawAll();

        assert.equal(await ethToken.balanceOf(accountHolder1), getWei('0.032').toString());
        assert.equal(await ethToken.balanceOf(accountHolder2), getWei('0.016').toString());
    });
});


function getWei(amountInEther) {
    return new BN(web3.utils.toWei(amountInEther, 'ether'));
}

async function transferToCloudMining(token, amountInWei) {
    return await token.transfer(cloudMining.address, amountInWei);
}

async function buyCloudMining(investorAddress, tokensAmountInWei, thirdPartyToken) {
    if (thirdPartyToken === undefined) {
        thirdPartyToken = tetherToken;
    }

    let decimalCurrentPrice = web3.utils.fromWei(await cloudMining.price(thirdPartyToken.address));
    let decimalTokensAmount = web3.utils.fromWei(tokensAmountInWei);

    let thirdPartyTokenAmount = getWei((decimalCurrentPrice * decimalTokensAmount).toString());
    
    // As investor: Allow CloudMining to withdraw USDT from Investor account
    await thirdPartyToken.methods["approve(address,uint256)"](cloudMining.address, thirdPartyTokenAmount.toString(), { from: investorAddress });

    // As investor: Attempt to enter in CloudMining and trigger USDT transfer to owner
    return await cloudMining.methods["enter(address,uint256)"](thirdPartyToken.address, tokensAmountInWei.toString(), { from: investorAddress });
}

function printTransactionCost(tx, comment) {
    const gasPrice = 0.00000001;
    const bnbPrice = 375;
    const gasUsed = tx.receipt.gasUsed;

    let cost = gasPrice * bnbPrice * gasUsed;
    cost = Math.round(cost * 10000) / 10000;

    if (typeof comment !== "undefined") {
        console.log(`\t${comment} tx cost is $${cost} (${gasUsed} gas used)`);
    } else {
        console.log(`tx cost is $${cost} (${gasUsed} gas used)`);
    }
}

async function assertTxFails(fn, msg) {
    let e = null;
    try {
        await fn();
    } catch (thrownException) {
        e = thrownException;
    } finally {
        assert.isNotNull(e);
        if (msg) {
            assert.ok(e.message.indexOf(msg) > -1, `Got unexpecded error message: ${e.message}. Expected: ${msg}`);
        }
    }
}
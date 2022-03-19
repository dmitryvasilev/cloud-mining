const { task } = require('hardhat/config');

require('dotenv').config();
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-truffle5");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("summary", "Prints contract's summary")
.addParam("address", "Deployed contract address")
.setAction(async function ({ address }, { ethers: { getSigners } }, runSuper) {
  const MyContract = await ethers.getContractFactory("CloudMining");
  const contract = await MyContract.attach(address);
  console.log('Contract summary:', await contract.getSummary());
});

task("balance", "Total supply of ERC-20 token")
.addParam("account", "Account address")
.setAction(async function ({ account }, { ethers: { getSigners } }, runSuper) {
  const allTokens = {
    'bscMainnet': [
      '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c', // BTCB
      '0x2170ed0880ac9a755fd29b2688956bd959f933f8', // ETH
      '0xe9e7cea3dedca5984780bafc599bd69add087d56', // BUSD
      '0x55d398326f99059ff775485246999027b3197955', // USDT
    ]
  };
  
  const tokens = allTokens[hre.network.name];
  if (!tokens) {
    throw 'Unsupported network given';
  }

  const [minter] = await ethers.getSigners();
  const erc20Token = await ethers.getContractFactory("TetherToken")

  console.log(`Account ${account} balances:`);

  let balance = web3.utils.fromWei(await web3.eth.getBalance(account), "ether");
  console.log(`- Native token balance is ${balance} BNB`);

  for (let k in tokens) {
    let tokenAddress = tokens[k];
    let erc20 = erc20Token.attach(tokenAddress)
    let interactableToken = await erc20.connect(minter);
    let balance = web3.utils.fromWei((await interactableToken.balanceOf(account)).toString(), 'ether')
    let symbol = await interactableToken.symbol()

    console.log(`- Contract ${tokenAddress} balance is ${balance} ${symbol}`);
  }
});


// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "hardhat",

  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    hardhat: {
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: {mnemonic: process.env.MNEMONIC}
    },
    bscMainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      gasPrice: 20000000000,
      accounts: {mnemonic: process.env.MNEMONIC}
    }
  },

  solidity: {
    compilers: [
      {
        version: "0.8.4",
      },
      {
        version: "0.4.17",
      },
    ],
  },
};
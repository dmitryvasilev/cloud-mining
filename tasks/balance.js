task("balance", "Total supply of ERC-20 token")
.addParam("account", "Account address")
.setAction(async function ({ account }, { ethers: { getSigners } }, runSuper) {
  const allTokens = {
    'bscTestnet': [
      '0xeAf9ec4Ff67D5AB3cc0f4D15CCb7A3e088653d39', // USDT
    ],
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

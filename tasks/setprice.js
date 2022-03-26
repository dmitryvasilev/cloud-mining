task("setprice", "Sets price")
.addParam("address", "Deployed contract address")
.addParam("token", "Third party token address")
.addParam("price", "Price in ether")
.setAction(async function ({ address, token, price }, { ethers: { getSigners } }, runSuper) {
  let wei = web3.utils.toWei(price, 'ether');

  const MyContract = await ethers.getContractFactory("CloudMining");
  const contract = await MyContract.attach(address);

  console.log('Price before:', await contract.price(token));
  await contract.setPrice(token, wei);
  console.log('Price after:', await contract.price(token));
});

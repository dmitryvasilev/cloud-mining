task("mint", "Mints some tokens")
.addParam("address", "Deployed contract address")
.addParam("amount", "Amount to mint")
.setAction(async function ({ address, amount }, { ethers: { getSigners } }, runSuper) {
  let wei = web3.utils.toWei(amount, 'ether');

  const MyContract = await ethers.getContractFactory("CloudMining");
  const contract = await MyContract.attach(address);

  console.log('Contract total supply before:', await contract.totalSupply());
  await contract.mint(address, wei);
  console.log('Contract total supply after:', await contract.totalSupply());
});

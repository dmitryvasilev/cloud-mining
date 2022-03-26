task("summary", "Prints contract's summary")
.addParam("address", "Deployed contract address")
.setAction(async function ({ address }, { ethers: { getSigners } }, runSuper) {
  const MyContract = await ethers.getContractFactory("CloudMining");
  const contract = await MyContract.attach(address);
  console.log('Contract summary:', await contract.getSummary());
});

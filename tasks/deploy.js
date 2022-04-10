task("deploy", "Deploys CloudMining contract")
  .addParam("mint", "Total supply (ether-sized)")
  .addParam("min", "Minimal investment (ether-sized)")
  .addParam("fee", "Initial fee (%)")
  .addParam("dryrun", "'1' = test run to check params; '0' = make real deployment")
  .setAction(async function ({ mint, min, fee, dryrun }, { ethers: { getSigners } }, runSuper) {
    const accounts = await hre.ethers.getSigners();
    
    console.log('Please verify the following params are correct:');
    console.log("- From account:       %s", accounts[0].address);
    console.log("- Network:            %s", hre.network.name);
    console.log("- Total supply:       %s (%s wei)", mint, web3.utils.toWei(mint, 'ether'));
    console.log("- Minimal investment: %s (%s wei)", min, web3.utils.toWei(min, 'ether'));
    console.log("- Fee:                %s%", fee);
    console.log("");

    if (dryrun === '0') {
      console.log('Deployment started...');

      const CloudMining = await hre.ethers.getContractFactory("CloudMining");
      const cloudMining = await CloudMining.deploy(web3.utils.toWei(mint, 'ether'), web3.utils.toWei(min, 'ether'), fee);
      
      let tx = await cloudMining.deployed();

      console.log('Success! Deployment details:');
      console.log('- Contract address:', cloudMining.address);
      console.log('- Transaction:', tx.deployTransaction.hash);
    }
});

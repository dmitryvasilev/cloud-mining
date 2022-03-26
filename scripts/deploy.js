const hre = require("hardhat");

async function main() {
  let conf = {
    "minAmount": process.env.DEPLOY_MIN_AMOUNT,
    "price": process.env.DEPLOY_PRICE,
    "fee": process.env.DEPLOY_FEE,
    "usdtAddress": process.env.DEPLOY_USDT_ADDRESS,
  };

  console.log('Please verify the params are correct:');
  console.log(conf);
  console.log('You have 5 seconds to terminate.');
  
  setTimeout(async () => {
    console.log('Deployment started...');

    // We get the contract to deploy
    const CloudMining = await hre.ethers.getContractFactory("CloudMining");
    const cloudMining = await CloudMining.deploy(conf.minAmount, conf.fee);
    
    let tx = await cloudMining.deployed();

    console.log('Success! Deployment details:');
    console.log('- Contract address:', cloudMining.address);
    console.log('- Transaction:', tx.deployTransaction.hash);
  }, 5000);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

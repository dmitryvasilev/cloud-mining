const { Spot } = require('@binance/connector');
const { recoverPublicKey } = require('ethers/lib/utils');
const { extendEnvironment } = require('hardhat/config');

let cloudMiningAddress = process.env.CLOUD_MINING_ADDRESS;

const client = new Spot(process.env.BINANCE_API_KEY, process.env.BINANCE_API_SECRET)

const getAssets = async () => {
  let assets = [];

  await client.assetDetail({ asset: 'ETC' })
  .then(response => assets = response.data)
  .catch(error => client.logger.error(error));

  return assets;
}

const withdraw = async (asset, amount, recipient) => {
  let result;

  await client.withdraw(
    asset,
    recipient,
    amount,
    {
      network: 'BSC', // BNB?
    }
  )
  .then(response => result = response)
  .catch(error => console.error(error))

  return result;
}

task("distribute", "Initiates profit distribution", async (taskArgs, hre) => {
  const CloudMining = await ethers.getContractFactory("CloudMining");
  const cloudMining = await CloudMining.attach(cloudMiningAddress);
  
  let assets = await getAssets();
  console.log(assets);
  return;

  //   await client.depositHistory(
  //     {
  //       coin: 'ETH',
  //     }
  //   )
  //   .then(response => console.log(response.data))
  //   .catch(error => client.logger.error(error));
  // return;


  // let assets = await getAssets();

  // TODO: Remove!!!
  cloudMiningAddress = '0xb48DF994d4592BdE2e1885375B1B9D9a25a57884'; // Dmitry Binance Wallet

  for (let k in assets) {
    console.log(assets[k]);

    let asset = assets[k].asset;
    let amount = assets[k].free;

//    let withdrawalId = await withdraw(asset, amount, cloudMiningAddress);
//    console.log('Withdrawal id:', withdrawalId);

    // TODO: Where is address?????
    // cloudMining.distribute();
  }
});


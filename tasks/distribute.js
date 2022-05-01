const { Spot } = require('@binance/connector');
const client = new Spot(process.env.BINANCE_API_KEY, process.env.BINANCE_API_SECRET)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const config = {
  // We can have more power than contracts will handle
  totalPower: 100,

  assets: {
    'ETH': '0x2170ed0880ac9a755fd29b2688956bd959f933f8', 
  },

  contracts: [
    { 
      address: '0xEb6D5A3c203c970804EB917b613Ce2288f501FE7', 
      power: 100 
    }
  ]
};


task("distribute", "Initiates profit distribution", async (taskArgs, hre) => {
  if (hre.network.name != 'bscMainnet') {
    throw new Error("Invalid network (" + hre.network.name + "). Should be bscMainnet.");
  }

  // Check power config consistency
  let contracts = getContractsShare();

  // Get assets
  let assets = await getAssets();
  console.log('Got assets:', assets);

  for (let k in assets) {
    await distributeAsset(assets[k], contracts);
  }
  
  console.log('Complete');
});


const getContractsShare = () => {
  let contractsPower = 0;
  let contractsShare = [];

  for (let k in config.contracts) {
    let contract = config.contracts[k];
    contract.share = contract.power / config.totalPower;
    contractsShare.push(contract);

    contractsPower += contract.power;
  }

  if (contractsPower > config.totalPower) {
    throw new Error("Invalid config: total power should be greater than contracts' power");
  }

  return contractsShare;
}


const getAssets = async () => {
  let assets = [];

  await client.fundingWallet()
    .then(response => assets = response.data)
    .catch(error => client.logger.error(error));

  for (let k in assets) {
    let asset = assets[k];

    // Check if we know about this asset
    if (typeof config.assets[asset.asset] === 'undefined') {
      console.log('WARNING: no address for asset $s', assets.asset);
      continue;
    }

    assets[k].address = config.assets[asset.asset];
  }
  
  return assets;
}


const distributeAsset = async (asset, contracts) => {
  for (let k in contracts) {
    let contract = contracts[k];
    let amount = asset.free * contract.share;

    if (amount >= 0.00014) {
      await withdrawTo(amount, asset.asset, contract.address);

      console.log('Waiting 30s before distribution...');
      await delay(30000);
      
      await triggerDistribute(contract.address, asset.address);
    }

  }
}


const withdrawTo = async (amount, asset, recipient) => {
  console.log('Attempting to withdraw %s %s to %s', amount, asset, recipient);

  await client.withdraw(
    asset,
    recipient,
    amount,
    {
      network: 'BSC', // BNB?
      walletType: 1 // Funding wallet
    }
  )
  .then(response => result = response)
  .catch((error) => { 
    console.log(error);
    console.error(error.response.data.msg);
    throw new Error(error);
  })

  console.log('Withdrawal complete!', result);
}


const triggerDistribute = async (contractAddress, assetAddress) => {
  const CloudMining = await ethers.getContractFactory("CloudMining");
  const cloudMining = await CloudMining.attach(contractAddress);

  console.log('Triggering %s.distribute(%s)...', contractAddress, assetAddress);
  let tx = await cloudMining.distribute(assetAddress);
  console.log('Complete!', tx);
}

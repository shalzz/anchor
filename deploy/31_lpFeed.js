var prompt = require('prompt-sync')();

module.exports = async ({
    deployments,
    getNamedAccounts
  }) => {
    console.log("31. Deploy LP Feed")
    const {deploy, save} = deployments;
    const {deployer} = await getNamedAccounts();

    const pair = prompt('Pair address: ');
    const feed0 = prompt('Feed 0 address: ');
    const feed1 = prompt('Feed 1 address: ');
    const decimals = prompt('decimals: ');
    const name = prompt('Pair name (for local storage): ');

    await deploy('LpFeed', {
      from: deployer,
      args:[
        pair,
        feed0,
        feed1,
        decimals
      ]
    });

    const contract = await deployments.get('LpFeed');
    await save(name, contract);

  };

  module.exports.tags = ['LpFeed'];
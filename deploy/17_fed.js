var prompt = require('prompt-sync')();

module.exports = async ({
    deployments,
    getNamedAccounts
  }) => {
    console.log("17. Deploy Fed")
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();
    const market = prompt('Dola market address: ');

    await deploy('Fed', {
      from: deployer,
      args:[
        market,
        deployer
      ]
    });
  };

  module.exports.tags = ['Fed'];

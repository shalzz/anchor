var prompt = require('prompt-sync')();

module.exports = async ({
    deployments,
    getNamedAccounts
  }) => {
    console.log("17. Deploy Fed")
    const {deploy, save} = deployments;
    const {deployer} = await getNamedAccounts();
    const market = prompt('Dola market address: ');
    const name = prompt('Fed name (for local storage): ');

    await deploy('Fed', {
      from: deployer,
      args:[
        market,
        deployer
      ]
    });

    const contract = await deployments.get('Fed');
    await save(name, contract);
  };

  module.exports.tags = ['Fed'];

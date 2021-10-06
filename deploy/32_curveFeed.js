var prompt = require('prompt-sync')();

module.exports = async ({
    deployments,
    getNamedAccounts
  }) => {
    console.log("32. Deploy Curve Feed")
    const {deploy, save} = deployments;
    const {deployer} = await getNamedAccounts();

    const pool = prompt('Pool address: ');
    const name = prompt('Pool name (for local storage): ');

    await deploy('CurveFeed', {
      from: deployer,
      args:[
        pool
      ]
    });

    const contract = await deployments.get('CurveFeed');
    await save(name, contract);

  };

  module.exports.tags = ['CurveFeed'];
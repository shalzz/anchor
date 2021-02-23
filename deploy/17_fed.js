module.exports = async ({
    deployments,
    getNamedAccounts
  }) => {
    console.log("17. Deploy Fed")
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    await deploy('Fed', {
      from: deployer,
      args:[
        (await deployments.get('anDola')).address,
        deployer
      ]
    });
  };

  module.exports.tags = ['Fed'];
  module.exports.dependencies = ['anDola'];
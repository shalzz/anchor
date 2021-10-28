module.exports = async ({
    deployments,
    getNamedAccounts
  }) => {
    console.log("34. Deploy xChainFed")
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    await deploy('xChainFed', {
      from: deployer
    });

  };

  module.exports.tags = ['xChainFed'];
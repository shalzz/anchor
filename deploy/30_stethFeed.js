module.exports = async ({
    deployments,
    getNamedAccounts
  }) => {
    console.log("30. Deploy stETH Feed")
    const {deploy} = deployments;
    const {deployer, ethFeed, stethEthFeed} = await getNamedAccounts();

    await deploy('StethFeed', {
      from: deployer,
      args:[
        stethEthFeed,
        ethFeed
      ]
    });
  };

  module.exports.tags = ['StethFeed'];
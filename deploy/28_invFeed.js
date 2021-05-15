module.exports = async ({
    deployments,
    getNamedAccounts
  }) => {
    console.log("28. Deploy INV Feed")
    const {deploy} = deployments;
    const {deployer, ethFeed, invKeep3rFeed, inv, weth} = await getNamedAccounts();

    await deploy('InvFeed', {
      from: deployer,
      args:[
        invKeep3rFeed,
        ethFeed,
        inv,
        weth
      ]
    });
  };

  module.exports.tags = ['InvFeed'];
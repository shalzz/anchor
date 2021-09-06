module.exports = async ({
    deployments,
    getNamedAccounts
  }) => {
    console.log("33. Deploy Dola Feed")
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    await deploy('DolaFeed', {
      from: deployer
    });

  };

  module.exports.tags = ['DolaFeed'];
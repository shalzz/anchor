module.exports = async ({
    deployments,
    getNamedAccounts
  }) => {
    console.log("25. Deploy XSushi Feed")
    const {deploy} = deployments;
    const {deployer, ethFeed, sushiFeed, sushiExchangeRate} = await getNamedAccounts();

    await deploy('XSushiFeed', {
      from: deployer,
      args:[
        sushiExchangeRate,
        sushiFeed,
        ethFeed
      ]
    });
  };

  module.exports.tags = ['XSushiFeed'];
var prompt = require('prompt-sync')();

module.exports = async ({
    deployments,
    getNamedAccounts
  }) => {
    console.log("27. Deploy anERC20 market")
    const {deploy, save} = deployments;

    const Unitroller = await deployments.get('Unitroller');
    const Model = await deployments.get('DolaInterestRateModel');
    const {deployer} = await getNamedAccounts();

    const name = prompt('Market name: ');
    const symbol = prompt('Market symbol: ');
    const underlyingAddress = prompt('Underlying token address: ');
    const exchangeRate = prompt('Initial exchange rate: ');

    await deploy('CErc20Immutable', {
      from: deployer,
      args:[
        underlyingAddress,
        Unitroller.address,
        Model.address,
        exchangeRate,
        name,
        symbol,
        "8",
        deployer
      ]
    });
    const market = await deployments.get('CErc20Immutable');
    await save(name, market);
  };

module.exports.tags = ['anERC20'];
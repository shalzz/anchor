module.exports = async ({
    deployments,
    getNamedAccounts,
  }) => {
    console.log("15. Add ETH Market")
    const {execute} = deployments;
    const {deployer} = await getNamedAccounts()

    await execute('Comptroller', {
        from: deployer
    },
        "_supportMarket",
        (await deployments.get('anETH')).address
    )
    return true
  };

module.exports.id = 'addEthMarket'
module.exports.tags = ['addEthMarket'];
module.exports.dependencies = ['Unitroller', 'anETH'];
module.exports = async ({
    deployments,
    getNamedAccounts,
  }) => {
    console.log("20. Set AnETH Collateral Factor to 50%")
    const {execute} = deployments;
    const {deployer} = await getNamedAccounts()

    await execute('Comptroller', {
        from: deployer
    },
        "_setCollateralFactor",
        (await deployments.get('anETH')).address,
        "500000000000000000" // 50%
    )
    return true
  };
module.exports.id = 'collateralFactor'
module.exports.tags = ['collateralFactor'];
module.exports.dependencies = ['addEthMarket'];
module.exports = async ({
    deployments,
    getNamedAccounts,
  }) => {
    console.log("20. Set Liquidation Incentive to 110%")
    const {execute} = deployments;
    const {deployer} = await getNamedAccounts()

    await execute('Comptroller', {
        from: deployer
    },
        "_setLiquidationIncentive",
        "1100000000000000000" // 110%
    )
    return true
  };
module.exports.id = 'liquidationIncentive'
module.exports.tags = ['liquidationIncentive'];
module.exports.dependencies = ['collateralFactor'];
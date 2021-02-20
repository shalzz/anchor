module.exports = async ({
    deployments,
    getNamedAccounts,
  }) => {
    console.log("16. Pause ETH borrowing")
    const {execute} = deployments;
    const {deployer} = await getNamedAccounts()

    await execute('Comptroller', {
        from: deployer,
        //gasLimit:"2000000"
    },
        "_setBorrowPaused",
        (await deployments.get('anETH')).address,
        true
    )
    return true
  };
module.exports.id = 'pauseETHBorrows'
module.exports.tags = ['pauseETHBorrows'];
module.exports.dependencies = ['addEthMarket'];
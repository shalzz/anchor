module.exports = async ({
    deployments,
    getNamedAccounts,
  }) => {
    console.log("14. Add Dola Market")
    const {execute} = deployments;
    const {deployer} = await getNamedAccounts()

    await execute('Comptroller', {
        from: deployer
    },
        "_supportMarket",
        (await deployments.get('anDola')).address
    )
    return true
  };

module.exports.id = 'addDolaMarket'
module.exports.tags = ['addDolaMarket'];
module.exports.dependencies = ['Unitroller', 'anDola'];
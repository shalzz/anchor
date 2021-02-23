module.exports = async ({
    deployments,
    getNamedAccounts,
  }) => {
    console.log("24. Set Close Factor to 50%")
    const {execute} = deployments;
    const {deployer} = await getNamedAccounts()

    await execute('Comptroller', {
        from: deployer
    },
        "_setCloseFactor",
        "500000000000000000" // 50%
    )
    return true
  };
module.exports.id = 'closeFactor'
module.exports.tags = ['closeFactor'];
module.exports.dependencies = ['acceptImplementation'];
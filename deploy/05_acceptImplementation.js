module.exports = async ({
    deployments,
    getNamedAccounts,
  }) => {
    console.log("5. Accept Implementation")
    const {execute, save} = deployments;
    const {deployer} = await getNamedAccounts()
    const UnitrollerAddress = (await deployments.get('Unitroller')).address
    await execute('Comptroller', {
        from: deployer
    },
        "_become",
        UnitrollerAddress
    )

    let Comptroller = await deployments.get('Comptroller');
    Comptroller.address = UnitrollerAddress; // Replace Comptroller address with proxy (Unitroller) for further references in the deploy scripts
    await save("Comptroller", Comptroller);
    return true
  };
module.exports.id = 'acceptImplementation';
module.exports.tags = ['acceptImplementation'];
module.exports.dependencies = ['setPendingImplementation'];
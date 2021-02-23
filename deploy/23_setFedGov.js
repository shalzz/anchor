module.exports = async ({
    deployments,
    getNamedAccounts,
  }) => {
    console.log("23. Set Fed Gov")
    const {execute} = deployments;
    const {deployer, gov} = await getNamedAccounts()

    await execute('Fed', {
        from: deployer
    },
        "changeGov",
        gov
    )
    return true
  };
module.exports.id = 'setFedGov'
module.exports.tags = ['setFedGov'];
module.exports.dependencies = ['Fed'];
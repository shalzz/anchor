module.exports = async ({
    deployments,
    getNamedAccounts,
  }) => {
    console.log("7. Deploy Dola Interest Rate Model")
    const {deploy, save} = deployments;
    const {deployer, gov} = await getNamedAccounts()

    await deploy('JumpRateModelV2', {
      from: deployer,
      args:[
          "0",
          "40000000000000000",
          "1500000000000000000",
          "750000000000000000",
          gov
      ]
    });

    const Model = await deployments.get('JumpRateModelV2');
    await save("DolaInterestRateModel", Model);
  };

module.exports.tags = ['DolaInterestRateModel'];
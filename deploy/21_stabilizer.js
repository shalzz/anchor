module.exports = async ({
    deployments,
    getNamedAccounts
  }) => {
    console.log("21. Deploy Stabilizer")
    const {deploy} = deployments;
    const {deployer, gov, dai} = await getNamedAccounts();

    await deploy('Stabilizer', {
      from: deployer,
      args:[
        (await deployments.get('Dola')).address,
        dai,
        gov,
        "10", // 0.1% buy fee
        "20", // 0.2% sell fee
        "1000000000000000000000000", // 1 million cap
      ]
    });
  };

  module.exports.tags = ['Stabilizer'];
  module.exports.dependencies = ['Dola'];
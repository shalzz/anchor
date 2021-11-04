module.exports = async ({
    deployments,
    getNamedAccounts,
  }) => {
    console.log("28. Deploy xINV")
    const { deploy, save } = deployments;
    const { deployer, inv, gov } = await getNamedAccounts();

    const comptroller = await deployments.get('Unitroller');
    const name = 'xINV';
    const symbol = 'XINV';
    const decimals = 18;

    await deploy('XINV', {
      from: deployer,
      args:[
          inv, // inverse as underlying
          comptroller.address,
          "6600000000000000", // reward per block
          gov,
          name,
          symbol,
          decimals,
          gov // governance as admin
      ]
    });

    const XINV = await deployments.get('XINV');

    await save("XINV", XINV);
  };

module.exports.tags = ['XINV'];
module.exports = async ({
    deployments,
    getNamedAccounts,
  }) => {
    console.log("28. Deploy xINV")
    const { deploy, save } = deployments;
    const { deployer, inv } = await getNamedAccounts();

    const comptroller = await deployments.get('Comptroller');
    const name = 'XINV';
    const symbol = 'XINV';
    const decimals = 18;

    await deploy('XINV', {
      from: deployer,
      args:[
          inv, // inverse as underlying
          comptroller.address,
          name,
          symbol,
          decimals,
          deployer // deployer as admin
      ]
    });

    const XINV = await deployments.get('XINV');

    await save("XINV", XINV);
  };

module.exports.tags = ['XINV'];
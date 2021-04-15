const { network } = require("hardhat");

module.exports = async ({
    deployments,
    getNamedAccounts,
  }) => {
    console.log("28. Deploy xINV")
    const { deploy, save, execute } = deployments;
    const { deployer } = await getNamedAccounts();

    let underlying = (await deployments.get('ERC20')).address;
    const comptroller = await deployments.get('Comptroller');
    const name = 'XINV';
    const symbol = 'XINV';
    const decimals = 18;
    const admin = '0xD93AC1B3D1a465e1D5ef841c141C8090f2716A16'; // timelock

    // underlying for XINV is INV, so deploy token first if network is hardhat or local
    const network_ = network.name;
    if (network_ == "hardhat" || network_ == "localhost") {
      await deploy('ERC20', {
        from: deployer,
        args: [
          "Invers DAO",
          "INV",
          "18"
        ]
      });

      const ERC20 = await deployments.get('ERC20');
      await save("ERC20-INV", ERC20);
      console.log(`INV hardhat token address: ${ERC20.address}`);
      // mint tokens
      await execute('ERC20-INV', {
        from: deployer,
      },
        "addMinter",
        deployer
      );

      await execute('ERC20-INV', {
        from: deployer
      },
        "mint",
        deployer,
        200
      );

      underlying = ERC20.address;
    }

    await deploy('XINV', {
      from: deployer,
      args:[
          underlying,
          comptroller.address,
          name,
          symbol,
          decimals,
          admin
      ]
    });

    const XINV = await deployments.get('XINV');

    await save("XINV", XINV);
  };

module.exports.tags = ['XINV'];
const { network } = require("hardhat");

module.exports = async ({
    deployments,
    getNamedAccounts,
  }) => {
    console.log("19. Set AnETH Collateral Factor to 50%")
    const { deploy, execute, save } = deployments;
    const {deployer} = await getNamedAccounts()

    // deploy mock oracle feed if network is local/hardhat
    // Comptroller._setCollateralFactor calls Oracle which calls feed when computing underlying price
    const network_ = network.name;
    if (network_ == 'hardhat' || network_ == 'localhost') {
      await deploy(
        'OracleFeed',
        {
          from: deployer,
          args: [
            18 // anETH
          ]
        }
      );
      const OracleFeed = await deployments.get('OracleFeed');
      await save('OracleFeed', OracleFeed);

      // now set feed for Oracle
      // get address of deployed OracleFeed and set that as feed for Oracle to use
      await execute('Oracle', {
          from: deployer,
        },
          "setFeed",
          (await deployments.get('anETH')).address,
          OracleFeed.address,
          18
      )
    }

    await execute('Comptroller', {
        from: deployer
    },
        "_setCollateralFactor",
        (await deployments.get('anETH')).address,
        "500000000000000000" // 50%
    )
    return true
  };
module.exports.id = 'collateralFactor'
module.exports.tags = ['collateralFactor'];
module.exports.dependencies = ['addEthMarket'];
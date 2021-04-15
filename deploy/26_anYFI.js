const { network } = require("hardhat");

module.exports = async ({
    deployments,
    getNamedAccounts
  }) => {
    console.log("26. Deploy anYFI")
    const {deploy, save, execute} = deployments;

    const Unitroller = await deployments.get('Unitroller');
    const Model = await deployments.get('DolaInterestRateModel');
    let {deployer, yfi, delegateRegistry} = await getNamedAccounts();

    // if network is hardhat, create and mint some underlying (yfi) tokens
    const network_ = network.name;
    if (network_ == "hardhat" || network_ == "localhost") {
      await deploy('ERC20', {
        from: deployer,
        args: [
          "Yearn Finance",
          "YFI",
          "8"
        ]
      });
      const ERC20 = await deployments.get('ERC20');
      await save("ERC20", ERC20);
      
      // mint tokens
      await execute('ERC20', {
        from: deployer,
      },
        "addMinter",
        deployer
      );

      await execute('ERC20', {
        from: deployer
      },
        "mint",
        deployer,
        200
      );

      // update mock yfi address
      yfi = ERC20.address;
    }
    

    await deploy('CYFI', {
      from: deployer,
      args:[
        yfi,
        Unitroller.address,
        Model.address,
        "200000000000000000000000000",
        "Anchor YFI",
        "anYFI",
        "8",
        deployer,
        delegateRegistry
      ]
    });
    const CYFI = await deployments.get('CYFI');
    await save("anYFI", CYFI);
  };

module.exports.dependencies = ['DolaInterestRateModel', 'Unitroller'];
module.exports.tags = ['anYFI'];
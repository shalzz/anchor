
module.exports = async ({
  deployments,
  getNamedAccounts
}) => {
  console.log("26. Deploy anYFI")
  const {deploy, save} = deployments;

  const Unitroller = await deployments.get('Unitroller');
  const Model = await deployments.get('DolaInterestRateModel');
  const {deployer, yfi, delegateRegistry} = await getNamedAccounts();

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
const hre = require('hardhat');
const {deployments, ethers} = hre;
const Multicall  = require('@0xsequence/multicall')
const Table = require('cli-table');

(async () => {
    try {
    const comptrollerDeployment = await deployments.get("Comptroller")
    const provider = new Multicall.providers.MulticallProvider(ethers.provider, {batchSize:1000000})
    const comptroller = new ethers.Contract(comptrollerDeployment.address, comptrollerDeployment.abi, provider)
    const filter = comptroller.filters.MarketEntered();
    const logs = await comptroller.queryFilter(filter, 0, "latest");
    let accounts = [...new Set(logs.map(v=>v.args.account))]
    const promises = accounts.map(v => comptroller.getAccountLiquidity(v))
    const accountsLiquidity = await Promise.all(promises)
    var positionTable = new Table({
        head: ['Address', 'Liquidity', 'Shortfall', 'Liquidatable']
    });
    let positions = accounts.map((v,i) => [v, accountsLiquidity[i][1], accountsLiquidity[i][2], accountsLiquidity[i][2].gt(0)])
    positions = positions.filter((v) => v[1].gt(0) || v[2].gt(0))
    positions = positions.map(v => [v[0], ethers.utils.formatEther(v[1]), ethers.utils.formatEther(v[2]), v[3]])
    positionTable.push(...positions)

    console.log("Positions:")
    console.log(positionTable.toString());

    var liquidatableTable = new Table({
        head: ['Address', 'Liquidity', 'Shortfall', 'Liquidatable']
    });

    const liquidatable = positions.filter(v => v[3] === true)
    liquidatableTable.push(...liquidatable)

    console.log("Liquidatable:")
    console.log(liquidatableTable.toString());
    } catch(e) {
        console.error(e)
    }
})();
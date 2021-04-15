require("@nomiclabs/hardhat-waffle");
require('@nomiclabs/hardhat-etherscan')
require('hardhat-deploy')
require('dotenv').config()
require('solidity-coverage')

require('@eth-optimism/smock/build/src/plugins/hardhat-storagelayout')

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.5.16",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  defaultNetwork: "hardhat",
  networks:{
<<<<<<< HEAD
    hardhat: {},
=======
    hardhat: {
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`
      }
    },
>>>>>>> test: Adding support for deployment on local hardhat network
    rinkeby:{
      url: `https://eth-rinkeby.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      accounts: [process.env.RINKEBY_PRIVKEY]
    },
    mainnet:{
      url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      accounts: [process.env.MAINNET_PRIVKEY]
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  namedAccounts: {
    dai: {
      1:"0x6b175474e89094c44da98b954eedeac495271d0f",
      4:"0xc7AD46e0b8a400Bb3C915120d284AafbA8fc4735",
      "hardhat": 4
    },
    ethFeed:{
      1:"0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
      4:"0x8A753747A1Fa494EC906cE90E9f37563A8AF630e",
      "hardhat": 5
    },
    yfi: {
      1:"0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e",
      "hardhat": 6
    },
    delegateRegistry: {
      1:"0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446",
      "hardhat": 7
    },
    sushiFeed:{
      1:"0xe572CeF69f43c2E488b33924AF04BDacE19079cf",
      "hardhat": 8
    },
    sushiExchangeRate:{
      1:"0x851a040fC0Dcbb13a272EBC272F2bC2Ce1e11C4d",
      "hardhat": 9
    },
    gov:{
      1:"0x926dF14a23BE491164dCF93f4c468A50ef659D5B",
      4:0,
      "hardhat": 1
    },
    inv: {
      1: "0x41d5d79431a913c4ae7d69a668ecdfe5ff9dfb68"
    },
    deployer:{
      default:0
    }
  }
};


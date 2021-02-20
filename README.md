Anchor Protocol
=================

Architecture
------------
Anchor is a fork of Compound. The main compound contracts (CToken, Comptroller, etc are not changed). The only change to the Compound protocol is the PriceOracle implementation which plugs into Chainlink feeds.

The main goal of the Anchor project is to re-use Compound's loan and debt management plumbing for the purpose of synthetic asset creation (Turning Compound into MakerDAO/Synthetix). This is achieved by creating an ERC20 token for each synth, minting it and supplying it exclusively to the protocol which will lend it to others in exchange for collateral.

**This achieves essentially the same architecture as MakerDAO but with few important differences:**
- The max supply of an Anchor-listed synth at any given point in time is defined by the amount minted and supplied to the protocol, as opposed to being minted on the fly in the case of Maker or Synthetix
- The borrowing interest rate (aka Stability Fee in the case of Maker) is dynamic based on the current interest rate model (as opposed to a preset rate defined by gov in the case of Maker). This also means that interest rate is a function of minted synth supply supplied to Anchor by gov and the borrowed supply, according to Compound's current interest rate model (which is subject to future experimentation). Governance can raise borrowing rates indirectly by monetary `contraction` by redeeming and burning some of the synth on Anchor, or lower rates by monetary `expansion` by minting and supplying more tokens to the protocol. This functionality is controlled by the `Fed` contract whose main mission is to use these powers to stabilize the peg.
- Interest generated from borrowing is shared between the governance (via the `Fed`) as the initial supplier and other synth holders who choose to re-deposit/supply their synths to the protocol. This means that all synths are natively yield-bearing. Governance can choose to lower the share of other suppliers interest by increasing Compound's `reserveFactor` variable.
- In the future, borrowing ETH using Dola as collateral will be allowed, meaning that those who supply ETH to use as collateral will also earn interest on their collateral (unlike Maker).
- In the future, by current design, different synths can be used to collateralize other synths (unlike Synthetix), which allows users to enter some unique leveraged positions.

**The main new contracts introduced are the following:**
- `ERC20`: Represents a synth token instance (e.g. Dola). Supports multiple minters. First minter will be the Fed. In the future, other minters can be added to allow for other functionalities such as 0-collateral lending.
- `Fed`: Each synth has its own Fed instance. The Fed is the middleware between the synth contract and Anchor and controls the monetary `expansion` and `contraction` of the synth on Anchor. Each Fed has a `chair` (owner), who is able to directly control monetary policy without having direct access to funds in transit.
- `Oracle`: A global oracle contract compatible with Compound's oracle interface. It is the middleware that transforms Chainlink price feed oracle format to Compound's. It also support setting fixed prices for certain assets (e.g. Dola which is set to $1).

**Initial launch phase:**
The main goal during the launch is to be as lean as possible. Anchor is very ambitious project but it must first be proven in its most simple form:
- In this phase, only one synth (Dola, pegged to $1) and one collateral (ETH) are supported.
- Dola can only be borrowed using ETH as collateral (and not the other way around, ETH borrowing is paused).
- Borrowing limit will be very uncompetitive at 50% limit (200% collateralization/liquidation threshold) to lower initial risk of insolvency.

Installation
------------
    yarn install --lock-file

Check out `.env.example` and copy it for `.env` file template

Compiling
------------
    yarn compile


Testing
-------

    yarn test

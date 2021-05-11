const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const hre = require("hardhat");
const { init, wallets, deployInv, deployXinv, 
    deployComptroller, deployUnitroller, deployJumpRateModelV2,
    deployOracleFeed, deployAndola, deployDola, deployOracle, 
    supportMarket, batchMintXinv, batchMintInv,
    evmMine } = require('../util/xinv');
const toMint3 = hre.ethers.utils.parseEther("3");

let inv;
let xINV;
let comptroller;
let unitroller;
let dola;
let anDOLA;
let oracle;
let oracleFeed;
let jumpRateModelV2;

describe("xINV Test", () => {

    before( async () => {
        await init();
    });
    
    beforeEach( async () => {
        inv = await deployInv();
        comptroller = await deployComptroller();
        unitroller = await deployUnitroller();
    
        await unitroller.connect(wallets.deployer)._setPendingImplementation(comptroller.address);
        await comptroller.connect(wallets.deployer)._become(unitroller.address);
    
        xINV = await deployXinv();
    
        // Ensure INV is transferable in test cases.
        await inv.connect(wallets.deployer).openTheGates();
    });
    
    describe('seizing', () => {

        let unitrollerProxy_;

        beforeEach( async () => {
            unitrollerProxy_ = await supportMarket(xINV.address, unitroller.address);

            await batchMintInv([ wallets.delegate, wallets.admin ], toMint3);
            await batchMintXinv([ wallets.deployer, wallets.admin ], toMint3);

            // create 2nd cToken market
            // set insanely high interest rate for testing purposes
            jumpRateModelV2 = await deployJumpRateModelV2();

            dola = await deployDola();

            anDOLA = await deployAndola();
            // support anDOLA market
            await expect(unitrollerProxy_.connect(wallets.deployer)._supportMarket(anDOLA.address)).to.emit(unitrollerProxy_, "MarketListed");

            oracleFeed = await deployOracleFeed();

            // set comptroller price oracle
            oracle = await deployOracle();
            const collateralPrice = hre.ethers.utils.parseEther("1");
            const borrowedPrice = BigNumber.from(2e10); // anDOLA
            await oracle.connect(wallets.deployer).setFeed(xINV.address, oracleFeed.address, 18);
            const feedData = await oracle.feeds(xINV.address);
            expect(feedData["addr"]).to.equal(oracleFeed.address);
            expect(feedData["tokenDecimals"]).to.equal(18);

            await oracle.connect(wallets.deployer).setFixedPrice(xINV.address, collateralPrice);
            expect(await oracle.fixedPrices(xINV.address)).to.equal(collateralPrice);

            await oracle.connect(wallets.deployer).setFixedPrice(anDOLA.address, borrowedPrice);
            expect(await oracle.fixedPrices(anDOLA.address)).to.equal(borrowedPrice);

            await expect(unitrollerProxy_.connect(wallets.deployer)._setPriceOracle(oracle.address)).to.emit(unitrollerProxy_, "NewPriceOracle");
        });

        it('seizes borrower collateral tokens when undercollateralized', async () => {
            const borrower = wallets.admin;
            const liquidator = wallets.deployer;
            // set params
            await supportMarket(xINV.address, unitroller.address);
            await supportMarket(anDOLA.address, unitroller.address);
            expect((await unitrollerProxy_.markets(xINV.address))["isListed"]).to.equal(true);
            expect((await unitrollerProxy_.markets(anDOLA.address))["isListed"]).to.equal(true);

            await expect(unitrollerProxy_.connect(wallets.deployer)._setCollateralFactor(xINV.address, "900000000000000000")).to.emit(unitrollerProxy_, "NewCollateralFactor");
            await expect(unitrollerProxy_.connect(wallets.deployer)._setCollateralFactor(anDOLA.address, "900000000000000000")).to.emit(unitrollerProxy_, "NewCollateralFactor");
            expect((await unitrollerProxy_.markets(xINV.address))["collateralFactorMantissa"]).to.equal("900000000000000000");
            
            // close factor. to calculate repayment
            await unitrollerProxy_.connect(wallets.deployer)._setCloseFactor("1000000000000000000");
            // incentive for liquidators
            await expect(unitrollerProxy_.connect(wallets.deployer)._setLiquidationIncentive("1100000000000000000"))
                .to.emit(unitrollerProxy_, "NewLiquidationIncentive");
            
            // transfer almost max of inv to borrower
            await batchMintInv([ borrower ], "999000000000000000000"); // 999
            await batchMintXinv([ borrower ], "999000000000000000000"); // 999

            await unitrollerProxy_.connect(wallets.deployer).enterMarkets([ xINV.address, anDOLA.address ]);

            // mint enough dola (anDOLA underlying)
            await dola.connect(wallets.deployer).mint(wallets.deployer.address, "850000000000000000000000"); // 850,000 DOLA
            await dola.connect(wallets.deployer).mint(borrower.address, "50000000000000000000000"); // 50,000 DOLA

            await dola.connect(wallets.deployer).approve(anDOLA.address, "850000000000000000000000");

            // mint anDOLA to provide underlying dola liquidity to anchor
            await dola.connect(borrower).approve(anDOLA.address, "50000000000000000000000");
            await anDOLA.connect(borrower).mint("50000000000000000000000"); // 50,000

            // check deposits (collaterals) of borrower

            // borrow ~ available balance (this amount should be less than total dola + minted anDOLA)
            await anDOLA.connect(borrower).borrow("45000000000000000000000");
            // at this point, borrower has 50K anDOLA and 45K dola
            // mine many blocks to accrue interest and make borrower undercollateralized
            // account is immediately liquidatable once shortfall > 0
            let shortfall = 0;
            while (shortfall == 0) {
                await evmMine();
                await anDOLA.accrueInterest();
                const [ _err, _liquidity, shortfall_ ] = await unitrollerProxy_.getAccountLiquidity(borrower.address);
                if (shortfall_ > 0) {
                    shortfall = shortfall_;
                }
            }
            
            // calculate amount to repay
            // accrue interest and get borrow balance stored for borrower
            await anDOLA.accrueInterest();
            const toRepay = await anDOLA.borrowBalanceStored(borrower.address);

            // seizable collateral tokens
            // tokens are transferred to liquidator in underlying
            // amount = scaled exchange rate * seizeTokens
            const [ _err, seizableXINV ] = await unitrollerProxy_.liquidateCalculateSeizeTokens(anDOLA.address, xINV.address, toRepay);

            const liquidatorSeizeTokensUnderlyingBefore = await inv.balanceOf(liquidator.address);
            const exchangeRateMantissa = await xINV.exchangeRateStored(); // same as current exchange rate
            const liquidatorExpectedRedeemedUnderlying = seizableXINV.mul(exchangeRateMantissa.div("1000000000000000000"));
            const borrowerXINVBalanceBefore = await xINV.balanceOf(borrower.address);

            // liquidateBorrow
            const borrowerBalanceBefore = await anDOLA.borrowBalanceStored(borrower.address);
            await expect(anDOLA.connect(liquidator).liquidateBorrow(borrower.address, toRepay, xINV.address))
                .to.emit(anDOLA, "LiquidateBorrow");

            // liquidator adjusted balances
            const liquidatorSeizeTokensUnderlyingAfter = await inv.balanceOf(liquidator.address);
            expect(liquidatorSeizeTokensUnderlyingAfter).to.equal(liquidatorSeizeTokensUnderlyingBefore.add(liquidatorExpectedRedeemedUnderlying));
            
            // collateral tokens of borrower less than before
            expect(await xINV.balanceOf(borrower.address)).to.lt(borrowerXINVBalanceBefore);
        });
    });
});
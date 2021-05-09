const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { init, wallets, deployInv, deployXinv, 
    deployComptroller, deployUnitroller,
    supportMarket, balanceOf, getBlockNumber,
    evmSetAutomine, evmMine } = require('../util/xinv');

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
    
    describe('accrue interest', () => {

        beforeEach( async () => {
            await supportMarket(xINV.address, unitroller.address);
        });

        it('should set the right rewards per block and treasury on init', async () => {
            const setRewardPerBlock = "200000000000000000";
            const setTreasury = wallets.treasury.address;

            expect(await xINV.rewardPerBlock()).to.equal(setRewardPerBlock);
            expect(await xINV.rewardTreasury()).to.equal(setTreasury);
        });

        it('should only allow admin to set treasury reward', async () => {
            const nonAdmin = wallets.delegate;
            const admin = wallets.deployer;
            const newTreasury = wallets.treasury;
            
            const treasuryBefore = await xINV.rewardTreasury();
            // expect no change in reward treasury
            await xINV.connect(nonAdmin)._setRewardTreasury(newTreasury.address);
            expect(await xINV.rewardTreasury()).to.equal(treasuryBefore);

            await expect(xINV.connect(admin)._setRewardTreasury(newTreasury.address))
                .to.emit(xINV, "NewRewardTreasury").withArgs(treasuryBefore, newTreasury.address);
            expect(await xINV.rewardTreasury()).to.equal(newTreasury.address);
        });

        it('should only allow admin to set reward per block', async () => {
            const nonAdmin = wallets.delegate;
            const admin = wallets.deployer;
            const newReward = "300000000000000000";
            
            const rewardBefore = await xINV.rewardPerBlock();
            // expect no change in reward per block with non-admin
            await xINV.connect(nonAdmin)._setRewardPerBlock(newReward);
            expect(await xINV.rewardPerBlock()).to.equal(rewardBefore);

            await expect(xINV.connect(admin)._setRewardPerBlock(newReward))
                .to.emit(xINV, "NewRewardPerBlock").withArgs(rewardBefore, newReward);
            expect(await xINV.rewardPerBlock()).to.equal(newReward);
    
        });

        it('should fail accruing twice on a given block and update accrual blocknumber after interest accrual', async () => {
            // simulate 2 calls in one block
            await evmSetAutomine(false);

            let accrualBlockNumberBefore = await getBlockNumber();
            await xINV.accrueInterest();
            await xINV.accrueInterest();
            let accrualBlockNumberAfter = await getBlockNumber();
            await evmMine();
            expect(accrualBlockNumberAfter).to.equal(accrualBlockNumberBefore);

            await evmSetAutomine(true);
            accrualBlockNumberBefore = await getBlockNumber();
            await xINV.accrueInterest();
            await xINV.accrueInterest();
            accrualBlockNumberAfter = await getBlockNumber();
            expect(BigNumber.from(accrualBlockNumberAfter)).to.equal(BigNumber.from(accrualBlockNumberBefore).add(2));
        });

        it('ensures right amount of interest is accrued for a given delta', async () => {
            await evmSetAutomine(false);
            const toMint = "10000000000000000000";
            await inv.connect(wallets.deployer).mint(wallets.treasury.address, toMint);
            await xINV.accrueInterest();
            await evmMine();
            // cannot transfer in after accrueInterest due to not enough allowance
            expect(await balanceOf(inv, xINV.address)).to.equal(0);

            await inv.connect(wallets.treasury).approve(xINV.address, toMint);

            const delta = 3;
            const expectedReward = String((await xINV.rewardPerBlock()) * delta);

            // xINV contract balance of underlying
            const contractBalanceBefore = await balanceOf(inv, xINV.address);
            // create delta of 3
            await xINV.accrueInterest();
            await evmMine();
            await xINV.accrueInterest();
            await evmMine();
            await xINV.accrueInterest();
            await evmMine();

            await evmSetAutomine(true);

            const contractBalanceAfter = await balanceOf(inv, xINV.address);
            expect(contractBalanceAfter).to.equal(contractBalanceBefore.add(expectedReward));  
        });

        it('should accrue interest from treasury', async () => {
            const toMint = "10000000000000000000";
            await inv.connect(wallets.deployer).mint(wallets.treasury.address, toMint);
            await inv.connect(wallets.treasury).approve(xINV.address, toMint);

            const contractBalanceBefore = await balanceOf(inv, xINV.address);
            const treasuryBalanceBefore = await balanceOf(inv, wallets.treasury.address);
            const blockNumberPrior = await xINV.accrualBlockNumber();
            await xINV.accrueInterest();
            const blockNumberCurrent = await xINV.accrualBlockNumber();
            const expectedReward = (await xINV.rewardPerBlock()).mul(blockNumberCurrent.sub(blockNumberPrior));
            const treasuryBalanceAfter = await balanceOf(inv, wallets.treasury.address);
            const contractBalanceAfter = await balanceOf(inv, xINV.address);

            expect(treasuryBalanceAfter).to.equal(treasuryBalanceBefore.sub(expectedReward));
            expect(contractBalanceAfter).to.equal(contractBalanceBefore.add(expectedReward));
        });
    });
});
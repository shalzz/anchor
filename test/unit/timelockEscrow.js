const { expect } = require("chai");
const hre = require("hardhat");
const { init, wallets, deployInv, deployXinv, 
    deployComptroller, deployUnitroller, 
    supportMarket, batchMintXinv,
    balanceOf, redeem, evmMine, 
    evmSetNextBlockTimestamp } = require('../util/xinv');
const toRedeem1 = hre.ethers.utils.parseEther("1");

describe("xINV Test", () => {

    let inv;
    let xINV;
    let comptroller;
    let unitroller;
    let timelockEscrow;

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
    
        await hre.deployments.save('xINV', xINV);
        const escrowAddress = await xINV.escrow();
        timelockEscrow = await hre.ethers.getContractAt("contracts/XINV.sol:TimelockEscrow", escrowAddress);
    
        // Ensure INV is transferable in test cases.
        await inv.connect(wallets.deployer).openTheGates();
    });
    
    describe('timelock escrow', function () {

        beforeEach( async () => {
            await supportMarket(xINV.address, unitroller.address);
        });

        it('sets governance, underlying and market on init', async () => {
            expect(await timelockEscrow.underlying()).to.equal(inv.address);
            expect(await timelockEscrow.governance()).to.equal(wallets.deployer.address);
            expect(await timelockEscrow.market()).to.equal(xINV.address);
        });

        it('only allows governance to set escrow duration', async () => {
            const nonGov = wallets.delegate;
            await expect(timelockEscrow.connect(nonGov)._setEscrowDuration(1e6))
                .to.revertedWith("revert only governance can set escrow duration");
            
            await timelockEscrow.connect(wallets.deployer)._setEscrowDuration(1e6);
            expect(await timelockEscrow.duration()).to.equal(1e6);
        });

        it('only allows governance to set another governance', async () => {
            const nonGov = wallets.delegate;
            await expect(timelockEscrow.connect(nonGov)._setGov(wallets.admin.address))
                .to.revertedWith("revert only governance can set its new address");
            
            await timelockEscrow.connect(wallets.deployer)._setGov(wallets.admin.address);
            expect(await timelockEscrow.governance()).to.equal(wallets.admin.address); 
        });

        it('accepts pending withdrawals', async () => {
            // approve  and mint
            await batchMintXinv([ wallets.deployer ], hre.ethers.utils.parseEther("5"));

            // redeem cToken aka xINV for underlying and check balances of both xINV and INV
            await redeem(xINV, wallets.deployer, toRedeem1);

            const escrowPendingWithdrawal = (await timelockEscrow.pendingWithdrawals(wallets.deployer.address))["amount"];
            expect(escrowPendingWithdrawal).to.equal(toRedeem1);
        });

        it('transfers withdrawable directly to redeemer if duration is 0', async () => {
            // approve  and mint
            await batchMintXinv([ wallets.deployer ], hre.ethers.utils.parseEther("5"));

            // send redeemer directly their withdrawable
            await timelockEscrow.connect(wallets.deployer)._setEscrowDuration(0);
            expect(await timelockEscrow.duration()).to.equal(0);

            // redeem cToken aka xINV for underlying
            const balanceBefore = await balanceOf(inv, wallets.deployer.address);
            await redeem(xINV, wallets.deployer, toRedeem1);
            expect(await balanceOf(inv, wallets.deployer.address)).to.equal(balanceBefore.add(toRedeem1));
        });

        it('fails withdrawal if withdrawal timestamp < current block timestamp', async () => {
            // approve  and mint
            await batchMintXinv([ wallets.deployer ], hre.ethers.utils.parseEther("5"));

            // redeem and check funds are SAFU in escrow
            await redeem(xINV, wallets.deployer, toRedeem1);
            expect((await timelockEscrow.pendingWithdrawals(wallets.deployer.address))["amount"]).to.equal(toRedeem1);

            // fast forward to time below withdrawal timestamp
            const timestamp = (await timelockEscrow.pendingWithdrawals(wallets.deployer.address))["withdrawalTimestamp"];
            await evmSetNextBlockTimestamp(timestamp.sub(5).toNumber());
            await evmMine();

            await expect(timelockEscrow.connect(wallets.deployer).withdraw()).to.be.revertedWith("revert Nothing to withdraw");
        });
    });
});
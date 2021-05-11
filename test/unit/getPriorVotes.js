const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const hre = require("hardhat");
const { init, wallets, deployInv, deployXinv, 
    deployComptroller, deployUnitroller,
    supportMarket, batchMintXinv, batchMintInv, redeem, 
    evmSetAutomine, evmMine, evmSetNextBlockTimestamp,
    delegate } = require('../util/xinv');
const toMint3 = hre.ethers.utils.parseEther("3");
const toRedeem1 = hre.ethers.utils.parseEther("1");

let inv;
let xINV;
let comptroller;
let unitroller;
let timelockEscrow;

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
    
        await hre.deployments.save('xINV', xINV);
        const escrowAddress = await xINV.escrow();
        timelockEscrow = await hre.ethers.getContractAt("contracts/XINV.sol:TimelockEscrow", escrowAddress);
    
        // Ensure INV is transferable in test cases.
        await inv.connect(wallets.deployer).openTheGates();
    });
    
    describe('get prior votes of xINV', () => {
        beforeEach( async () => {
            await supportMarket(xINV.address, unitroller.address);

            await batchMintInv([ wallets.delegate, wallets.admin ], toMint3);
            await batchMintXinv([ wallets.deployer, wallets.admin ], toMint3);
        });

        it('reverts if block number is greater than or equal to current block', async () => {
            await expect(xINV.getPriorVotes(wallets.delegate.address, 5e10))
                .to.revertedWith("revert INV::getPriorVotes: not yet determined");
        });

        it('returns 0 if there are no checkpoints', async () => {
            expect(await xINV.getPriorVotes(wallets.delegate.address, 0)).to.equal(0);
        });

        it('returns the latest block if >= last checkpoint block', async () => {
            await evmSetAutomine(false);

            let txn1 = xINV.connect(wallets.deployer).delegate(wallets.delegate.address);
            await evmSetAutomine(true);
            txn1 = await txn1;
            await evmMine(); await evmMine();

            expect(await xINV.getPriorVotes(wallets.delegate.address, txn1.blockNumber))
                .to.equal(hre.ethers.utils.parseEther("3"));
            expect(await xINV.getPriorVotes(wallets.delegate.address, txn1.blockNumber + 1))
                .to.equal(hre.ethers.utils.parseEther("3"));
        });

        it ('returns 0 if < first checkpoint block', async () => {
            await evmMine();
            const txn = await delegate(xINV, wallets.deployer, wallets.delegate.address);
            await evmMine(); await evmMine();

            expect(await xINV.getPriorVotes(wallets.delegate.address, txn.blockNumber - 1))
                .to.equal(0);
            expect(await xINV.getPriorVotes(wallets.delegate.address, txn.blockNumber + 1))
                .to.equal(hre.ethers.utils.parseEther("3"));
        });

        it('returns the voting balance at the appropriate checkpoint', async () => {
            const txn1 = await delegate(xINV, wallets.deployer, wallets.delegate.address);
            await evmMine(); await evmMine();

            const txn2 = await delegate(xINV, wallets.admin, wallets.delegate.address);
            await evmMine(); await evmMine();

            const txn3 = await redeem(xINV, wallets.admin, toRedeem1);
            await evmMine(); await evmMine();

            // escrow is explicitly set to true for redeeming, so fastforward to duration and withdraw
            // fast forward to withdrawaltimestamp
            const timestamp = (await timelockEscrow.pendingWithdrawals(wallets.admin.address))["withdrawalTimestamp"];
            await evmSetNextBlockTimestamp(timestamp.add(20).toNumber());
            await evmMine();

            // withdraw funds from escrow
            await expect(timelockEscrow.connect(wallets.admin).withdraw())
                .to.emit(timelockEscrow, "Withdraw").withArgs(wallets.admin.address, toRedeem1);
            
            await evmMine();
            // txn1
            expect(await xINV.getPriorVotes(wallets.delegate.address, txn1.blockNumber - 1))
                .to.equal(0);
            expect(await xINV.getPriorVotes(wallets.delegate.address, txn1.blockNumber))
                .to.equal(hre.ethers.utils.parseEther("3"));
            expect(await xINV.getPriorVotes(wallets.delegate.address, txn1.blockNumber + 1))
                .to.equal(hre.ethers.utils.parseEther("3"));
            // txn 2
            expect(await xINV.getPriorVotes(wallets.delegate.address, txn2.blockNumber))
                .to.equal(hre.ethers.utils.parseEther("6"));
            expect(await xINV.getPriorVotes(wallets.delegate.address, txn2.blockNumber + 1))
                .to.equal(hre.ethers.utils.parseEther("6"));
            // txn3
            expect(await xINV.getPriorVotes(wallets.delegate.address, txn3.blockNumber))
                .to.equal("6000000000000000000");
        });
    });
});
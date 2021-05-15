const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const hre = require("hardhat");
const { init, wallets, deployInv, deployXinv, 
    deployComptroller, deployUnitroller, 
    supportMarket, batchMintXinv, batchMintInv,
    getBlockNumber, getBlockByBlockNumber,
    delegate } = require('../util/xinv');
const toMint3 = hre.ethers.utils.parseEther("3");

let inv;
let xINV;
let comptroller;
let unitroller;

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
    
    describe('delegation', function() {

        beforeEach( async () => {
            await supportMarket(xINV.address, unitroller.address);
        });
        
        it('reverts for invalid signatory', async () => {
            const nonce = 0;
            const expiry = 0;
            await expect(xINV.delegateBySig(wallets.deployer.address, nonce, expiry, 0, '0xbad', '0xbad'))
                .to.reverted;
        });

        it('reverts for invalid nonce, invalid expiry and invalid signature', async () => {
            // get right nonce
            const nonce = await xINV.nonces(wallets.delegate.address);
            const invalidNonce = nonce.add(1); 
            const invalidExpiry = 0;

            // rightfully obtain expiry
            const blockNumber = await getBlockNumber();
            const block = await getBlockByBlockNumber(blockNumber);
            const blockTimestamp = block.timestamp;
            const expiry = BigNumber.from(blockTimestamp).add(3600);

            const messageHash = hre.ethers.utils.id(JSON.stringify({delegatee: wallets.delegate.address, nonce, expiry}));
            const messageHashBytes = hre.ethers.utils.arrayify(messageHash);
            const flatSignature = await wallets.deployer.signMessage(messageHashBytes);
            const signature = hre.ethers.utils.splitSignature(flatSignature);

            // expect failure with invalid nonce
            await expect(xINV.connect(wallets.deployer).delegateBySig(wallets.delegate.address, invalidNonce, expiry, signature.v, signature.r, signature.s))
                .to.revertedWith("revert INV::delegateBySig: invalid nonce");
            
            // expect failure with invalid expiry
            await expect(xINV.connect(wallets.deployer).delegateBySig(wallets.delegate.address, nonce, invalidExpiry, signature.v, signature.r, signature.s))
                .to.be.revertedWith("revert INV::delegateBySig: signature expired");

            // valid nonce, expiry and signature
            await expect(xINV.connect(wallets.deployer).delegateBySig(wallets.delegate.address, nonce, expiry, signature.v, signature.r, signature.s))
                .to.emit(xINV, "DelegateChanged");
        });

        it('gets current votes', async () => {

            await batchMintInv([wallets.admin, wallets.delegate], toMint3);
            await batchMintXinv([wallets.admin, wallets.deployer], toMint3);

            // 2 different delegations to delegate
            expect(await xINV.getCurrentVotes(wallets.delegate.address)).to.equal(0);

            await expect(delegate(xINV, wallets.admin, wallets.delegate.address))
                .to.emit(xINV, "DelegateVotesChanged");
            expect(await xINV.getCurrentVotes(wallets.delegate.address)).to.equal(toMint3);

            await delegate(xINV, wallets.deployer, wallets.delegate.address);
            expect(await xINV.getCurrentVotes(wallets.delegate.address)).to.equal(toMint3.mul(2));
        });
    });
});
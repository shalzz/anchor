const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const hre = require("hardhat");

describe("Test", () => {
    const wallets = {};

    let INVArtifact;
    let XINVArtifact;
    let ComptrollerArtifact;
    let UnitrollerArtifact;

    let inv;
    let xINV;
    let comptroller;
    let unitroller;
    let timelockEscrow;

    before(async () => {
        INVArtifact = await hre.artifacts.readArtifact('INV');
        XINVArtifact = await hre.artifacts.readArtifact('XINV');
        ComptrollerArtifact = await hre.artifacts.readArtifact('Comptroller');
        UnitrollerArtifact = await hre.artifacts.readArtifact('Unitroller');

        const signers = await hre.ethers.getSigners();

        wallets.admin = signers[0];
        wallets.deployer = signers[1];
        wallets.delegate = signers[2];
    });

    beforeEach(async () => {
        inv = await hre.waffle.deployContract(wallets.deployer, INVArtifact, [wallets.deployer.address]);
        comptroller = await hre.waffle.deployContract(wallets.deployer, ComptrollerArtifact, []);
        unitroller = await hre.waffle.deployContract(wallets.deployer, UnitrollerArtifact, []);

        await unitroller.connect(wallets.deployer)._setPendingImplementation(comptroller.address);
        await comptroller.connect(wallets.deployer)._become(unitroller.address);

        xINV = await hre.waffle.deployContract(
            wallets.deployer,
            XINVArtifact,
            [
                inv.address,
                unitroller.address,
                "xInverse Finance",
                "xINV",
                "18",
                wallets.deployer.address,
            ],
        );
        const escrowAddress = await xINV.escrow();
        timelockEscrow = await hre.ethers.getContractAt("contracts/XINV.sol:TimelockEscrow", escrowAddress);

        // Ensure INV is transferable in test cases.
        await inv.connect(wallets.deployer).openTheGates();
    });

    describe('XINV minting and redeeming', function() {

        it('should only be minted if allowed by comptroller', async () => {
            // Get the proxied interface by retrieving the Comptroller contract
            // at Unitroller's address.
            const unitrollerProxy = await hre.ethers.getContractAt(
                "Comptroller",
                unitroller.address,
            );
            //const comptrollerAddress = comptroller;
            const comptrollerProxy = await hre.ethers.getContractAt(
                "Comptroller",
                comptroller.address
            );

            await unitrollerProxy.connect(wallets.deployer)._supportMarket(xINV.address);
            // pause mint
            await unitrollerProxy.connect(wallets.deployer)._setMintPaused(xINV.address, true);       

            // now attempt mint, should revert
            const toMint = hre.ethers.utils.parseEther("1");
            await inv.connect(wallets.deployer).transfer(wallets.admin.address, toMint);
            await inv.connect(wallets.admin).approve(xINV.address, toMint);
            await expect(xINV.connect(wallets.admin).mint(toMint)).to.be.revertedWith("revert mint is paused");

        });

        it('should only be minted if user has equal or more amount of INV', async () => {
            const toMint = hre.ethers.utils.parseEther("1")

            // Get the proxied interface by retrieving the Comptroller contract
            // at Unitroller's address.
            const unitrollerProxy = await hre.ethers.getContractAt(
                "Comptroller",
                unitroller.address,
            );

            await unitrollerProxy.connect(wallets.deployer)._supportMarket(xINV.address);

            // Approve the transfer of collateral and then transfer to mint xINV.
            await expect(inv.connect(wallets.deployer).approve(xINV.address, toMint))
                .to.emit(inv, "Approval").withArgs(wallets.deployer.address, xINV.address, toMint);
            await expect(xINV.connect(wallets.deployer).mint(toMint)).to.emit(xINV, "Mint");

            const balanceXINV = await xINV.balanceOf(wallets.deployer.address);
            expect(balanceXINV).to.equal(toMint);

            // minting without enough INV
            await expect(xINV.connect(wallets.deployer).mint(toMint)).to.be.reverted;
        });

        it('should be able to redeem xINV for underlying INV', async() => {
            const toMint = hre.ethers.utils.parseEther("2");
            // Get the proxied interface by retrieving the Comptroller contract
            // at Unitroller's address.
            const unitrollerProxy = await hre.ethers.getContractAt(
                "Comptroller",
                unitroller.address,
            );

            await unitrollerProxy.connect(wallets.deployer)._supportMarket(xINV.address);

            // expect failure due to insufficient approval
            await expect(xINV.connect(wallets.deployer).mint(toMint)).to.be.reverted;

            // approve to spend some more
            await inv.connect(wallets.deployer).approve(xINV.address, hre.ethers.utils.parseEther("5"));
            await expect(xINV.connect(wallets.deployer).mint(toMint)).to.emit(xINV, "Mint");

            // redeem cToken aka xINV for underlying and check balances of both xINV and INV
            const toRedeem = hre.ethers.utils.parseEther("1");
            await expect(xINV.connect(wallets.deployer).redeem(toRedeem)).to.emit(xINV, "Redeem");

            // escrow is used, so should be able to withdraw explicitly after duration
            // escrow is explicitly set to true for redeeming, so fastforward to duration and withdraw
            const duration = await timelockEscrow.duration();
  
            await hre.network.provider.send("evm_increaseTime", [ duration.sub(3600).toNumber() ]);
            await hre.network.provider.send("evm_mine");
            // withdraw funds from escrow
            const oldBalance = await inv.balanceOf(wallets.deployer.address);

            await expect(timelockEscrow.connect(wallets.deployer).withdraw())
                .to.emit(timelockEscrow, "Withdraw").withArgs(wallets.deployer.address, toRedeem);
            
            expect(await inv.balanceOf(wallets.deployer.address)).to.be.equal(oldBalance.add(toRedeem));
        });
    });

    describe('xINV delegation by signature', function() {
        
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
            const blockNumber = await hre.network.provider.send("eth_blockNumber")
            const block = await hre.network.provider.send("eth_getBlockByNumber", [ blockNumber, true ]);
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
    });

    describe('xINV number of checkpoints', function () {
        beforeEach(async () => {
            // Get the proxied interface by retrieving the Comptroller contract
            // at Unitroller's address.
            const unitrollerProxy = await hre.ethers.getContractAt(
                "Comptroller",
                unitroller.address,
            );

            await unitrollerProxy.connect(wallets.deployer)._supportMarket(xINV.address);

            const toMint = hre.ethers.utils.parseEther("3");

            await inv.connect(wallets.deployer).mint(wallets.delegate.address, toMint);
            await inv.connect(wallets.deployer).mint(wallets.admin.address, toMint);

            //await inv.connect(wallets.delegate).approve(xINV.address, toMint);
            await inv.connect(wallets.admin).approve(xINV.address, toMint);
            await inv.connect(wallets.deployer).approve(xINV.address, toMint);

            //await xINV.connect(wallets.delegate).mint(toMint);
            await xINV.connect(wallets.deployer).mint(toMint);
            await xINV.connect(wallets.admin).mint(toMint);

            expect(await xINV.balanceOf(wallets.deployer.address)).to.be.equal(toMint);
            //expect(await xINV.balanceOf(wallets.delegate.address)).to.be.equal(toMint);
            expect(await xINV.balanceOf(wallets.admin.address)).to.be.equal(toMint);
        });

        it('returns the number of checkpoints for a delegate', async () => {
            const txn1 = await xINV.connect(wallets.deployer).delegate(wallets.delegate.address);
            expect(await xINV.numCheckpoints(wallets.delegate.address)).to.be.equal(1);

            // 2 different delegations to delegate
            const txn2 = await xINV.connect(wallets.admin).delegate(wallets.delegate.address);
            expect(await xINV.numCheckpoints(wallets.delegate.address)).to.be.equal(2);

            const checkPoint1 = await xINV.checkpoints(wallets.delegate.address, 0);
            const checkPoint2 = await xINV.checkpoints(wallets.delegate.address, 1);

            expect(checkPoint1).to.have.property('fromBlock').to.equal(txn1.blockNumber);
            expect(checkPoint1).to.have.property('votes').to.equal(hre.ethers.utils.parseEther('3'));

            expect(checkPoint2).to.have.property('fromBlock').to.equal(txn2.blockNumber);
            expect(checkPoint2).to.have.property('votes').to.equal(hre.ethers.utils.parseEther('6'));

        });
        // this test only works with hardhat 2.2.0 due to "evm_setAutomine" for runtime mining manipulation
        it('does not include more than one checkpoint in a block', async () => {
            // trigger to not mine new block automatically, unless explicit mining
            await hre.network.provider.send("evm_setAutomine", [ false ]);

            const stopMiningBlockNumber = await hre.network.provider.send("eth_blockNumber");

            // # of checkpoints for delegate at this stage should be 0
            expect(await xINV.numCheckpoints(wallets.delegate.address)).to.equal(0);

            // only one of these should be mined in the next block after mining resumed
            let txn1 = await xINV.connect(wallets.admin).delegate(wallets.delegate.address);
            let txn2 = await xINV.connect(wallets.deployer).delegate(wallets.delegate.address);
            
            //txn1 = await txn1;
            //txn2 = await txn2;
            await hre.network.provider.send('evm_mine');

            const afterStartMiningBlockNumber = await hre.network.provider.send("eth_blockNumber");

            // only 1 block mined, which we explicitly did above
            expect(afterStartMiningBlockNumber - stopMiningBlockNumber).to.be.equal(1);

            // delegated twice but only 1 mined
            expect(await xINV.numCheckpoints(wallets.delegate.address)).to.equal(1);

            // only one of two txns successfully mined
            expect(await xINV.checkpoints(wallets.delegate.address, 0))
                .to.have.property('fromBlock').to.equal(BigNumber.from(afterStartMiningBlockNumber));
            
            // didn't make it to block after mining resumed
            expect(await xINV.checkpoints(wallets.delegate.address, 1))
                .to.have.property('fromBlock').to.equal(0); 

            // now try mining second delegation again
            //let txn3 = xINV.connect(wallets.deployer).delegate(wallets.delegate.address);
            //await hre.network.provider.send("evm_setAutomine", [true]);
            //txn3 = await txn3;
            //xINV.connect(wallets.deployer).transfer(wallets.delegate.address, '1');
            //await hre.network.provider.send("evm_mine");
            //console.log(txn3)
            //console.log(await xINV.numCheckpoints(wallets.delegate.address));
            //console.log(await xINV.checkpoints(wallets.delegate.address, 5))

            await hre.network.provider.send('evm_setAutomine', [ true ]);
        });
    });

    describe('get prior votes of xINV', function () {
        beforeEach( async () => {
            this.timeout(0)
            // Get the proxied interface by retrieving the Comptroller contract
            // at Unitroller's address.
            const unitrollerProxy = await hre.ethers.getContractAt(
                "Comptroller",
                unitroller.address,
            );
            
            await unitrollerProxy.connect(wallets.deployer)._supportMarket(xINV.address);

            const toMint = hre.ethers.utils.parseEther("3");

            await inv.connect(wallets.deployer).mint(wallets.delegate.address, toMint);
            await inv.connect(wallets.deployer).mint(wallets.admin.address, toMint);

            //await inv.connect(wallets.delegate).approve(xINV.address, toMint);
            await inv.connect(wallets.admin).approve(xINV.address, toMint);
            await inv.connect(wallets.deployer).approve(xINV.address, toMint);

            //await xINV.connect(wallets.delegate).mint(toMint);
            await xINV.connect(wallets.deployer).mint(toMint);
            await xINV.connect(wallets.admin).mint(toMint);
        });

        it('reverts if block number is greater than or equal to current block', async () => {
            await expect(xINV.getPriorVotes(wallets.delegate.address, 5e10))
                .to.revertedWith("revert INV::getPriorVotes: not yet determined");
        });

        it('returns 0 if there are no checkpoints', async () => {
            expect(await xINV.getPriorVotes(wallets.delegate.address, 0)).to.equal(0);
        });

        it('returns the latest block if >= last checkpoint block', async () => {
            await hre.network.provider.send("evm_setAutomine", [ false ]);

            let txn1 = xINV.connect(wallets.deployer).delegate(wallets.delegate.address);
            await hre.network.provider.send("evm_setAutomine", [ true ]);
            txn1 = await txn1;
            await hre.network.provider.send("evm_mine");
            await hre.network.provider.send("evm_mine");

            let latestBlock = await hre.network.provider.send("eth_blockNumber");
            expect(await xINV.getPriorVotes(wallets.delegate.address, txn1.blockNumber))
                .to.equal(hre.ethers.utils.parseEther("3"));
            expect(await xINV.getPriorVotes(wallets.delegate.address, txn1.blockNumber + 1))
                .to.equal(hre.ethers.utils.parseEther("3"));
        });

        it ('returns 0 if < first checkpoint block', async () => {
            await hre.network.provider.send("evm_mine");
            const txn = await xINV.connect(wallets.deployer).delegate(wallets.delegate.address);
            await hre.network.provider.send("evm_mine");
            await hre.network.provider.send("evm_mine");

            expect(await xINV.getPriorVotes(wallets.delegate.address, txn.blockNumber - 1))
                .to.equal(0);
            expect(await xINV.getPriorVotes(wallets.delegate.address, txn.blockNumber + 1))
                .to.equal(hre.ethers.utils.parseEther("3"));
        });

        it('returns the voting balance at the appropriate checkpoint', async () => {
            const txn1 = await xINV.connect(wallets.deployer).delegate(wallets.delegate.address);
            await hre.network.provider.send("evm_mine");
            await hre.network.provider.send("evm_mine");

            const txn2 = await xINV.connect(wallets.admin).delegate(wallets.delegate.address);
            await hre.network.provider.send("evm_mine");
            await hre.network.provider.send("evm_mine");

            const toRedeem = hre.ethers.utils.parseEther("1");
            const txn3 = await xINV.connect(wallets.admin).redeem(toRedeem);
            await hre.network.provider.send("evm_mine");
            await hre.network.provider.send("evm_mine");
            // escrow is explicitly set to true for redeeming, so fastforward to duration and withdraw
            // fast forward to duration + timestamp
            const duration = await timelockEscrow.duration();
            //const withdrawal = await timelockEscrow.pendingWithdrawals(wallets.admin.address);
  
            await hre.network.provider.send("evm_increaseTime", [ duration.sub(3600).toNumber() ]);
            await hre.network.provider.send("evm_mine");
            // withdraw funds from escrow

            await expect(timelockEscrow.connect(wallets.admin).withdraw())
                .to.emit(timelockEscrow, "Withdraw").withArgs(wallets.admin.address, toRedeem);
            
            await hre.network.provider.send("evm_mine");
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

            // before time increased 
            expect(await xINV.getPriorVotes(wallets.delegate.address, txn3.blockNumber))
                .to.equal("6000000000000000000");
            // after time increase and withdrawal
            //const blockNumber = await hre.network.provider.send("eth_blockNumber");
            //console.log(blockNumber)
            //console.log(wallets.admin.address)
            //expect(await xINV.getPriorVotes(wallets.delegate.address, txn3.blockNumber + 1))
            //    .to.equal(hre.ethers.utils.parseEther("5"));
        });
    });

});
//"hardhat": "^2.0.8",
//    "hardhat-deploy": "^0.7.0-beta.44",
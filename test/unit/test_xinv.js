const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const hre = require("hardhat");

describe("Test", () => {
    const wallets = {};

    let INVArtifact;
    let XINVArtifact;
    let ComptrollerArtifact;
    let UnitrollerArtifact;
    let TokenErrorReporterArtifact;

    let inv;
    let xINV;
    let comptroller;
    let unitroller;
    let timelockEscrow;
    let tokenErrorReporter;

    before(async () => {
        INVArtifact = await hre.artifacts.readArtifact('INV');
        XINVArtifact = await hre.artifacts.readArtifact('XINV');
        ComptrollerArtifact = await hre.artifacts.readArtifact('Comptroller');
        UnitrollerArtifact = await hre.artifacts.readArtifact('Unitroller');
        TokenErrorReporterArtifact = await hre.artifacts.readArtifact('TokenErrorReporter');

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
        tokenErrorReporter = await hre.waffle.deployContract(wallets.deployer, TokenErrorReporterArtifact);

        // Ensure INV is transferable in test cases.
        await inv.connect(wallets.deployer).openTheGates();
    });
    
    const toMint1 = hre.ethers.utils.parseEther("1");
    const toMint2 = hre.ethers.utils.parseEther("2");
    const toMint3 = hre.ethers.utils.parseEther("3");
    const toRedeem1 = hre.ethers.utils.parseEther("1");
    const supportMarket = async (market_, unitroller_) => {
        // Get the proxied interface by retrieving the Comptroller contract
        // at Unitroller's address.
        const unitrollerProxy = await hre.ethers.getContractAt(
            "Comptroller",
            unitroller_,
        );
    
        await unitrollerProxy.connect(wallets.deployer)._supportMarket(market_);
    
        return unitrollerProxy;
    }
    
    const pauseMint = async (unitroller_, xINV_) => {
        const unitrollerProxy = await hre.ethers.getContractAt(
            "Comptroller",
            unitroller_,
        );
        await unitrollerProxy.connect(wallets.deployer)._setMintPaused(xINV_, true);
    }
    
    const address = async (n) => {
        const address_ = `0x${n.toString(16).padStart(40, '0')}`;
        return address_.toString()
    }
    
    const batchMint = async (wallets_, toMint = hre.ethers.utils.parseEther("1")) => {
        return Promise.all(wallets_.map( async wallet => {
            await inv.connect(wallet).approve(xINV.address, toMint);
            await xINV.connect(wallet).mint(toMint);
            
            return Promise.resolve(true);
        }));
    }
    
    const batchTransferInv = async (wallets_, toMint) => {
        return Promise.all(wallets_.map( async wallet => {
            return Promise.resolve(await inv.connect(wallets.deployer).mint(wallet.address, toMint));
        }));
    }
    
    const balanceOf = async (token_, address_) => {
        return await token_.balanceOf(address_);
    }
    
    const redeem = async (token_, signer_, toRedeem_) => {
        return await token_.connect(signer_).redeem(toRedeem_);
    }
    
    const getBlockNumber = async () => {
        return await hre.network.provider.send("eth_blockNumber");
    }
    
    const getBlockByBlockNumber = async (blockNumber) => {
        return await hre.network.provider.send("eth_getBlockByNumber", [ blockNumber, true ]);
    }
    
    const evmSetAutomine = async (state) => {
        return await hre.network.provider.send("evm_setAutomine", [ state ]);
    }
    
    const evmMine = async () => { return await hre.network.provider.send("evm_mine"); }
    
    const evmIncreaseTime = async (duration_) => { 
        return await hre.network.provider.send("evm_increaseTime", [ duration_ ]);
    }

    const evmSetNextBlockTimestamp = async (timestamp_) => {
        return await hre.network.provider.send("evm_setNextBlockTimestamp", [ timestamp_ ]);
    } 
    
    const delegate = async (token_, signer_, delegate_) => {
        return await token_.connect(signer_).delegate(delegate_)
    }

    describe('comptroller', function() {

        beforeEach( async () => {
            await supportMarket(xINV.address, unitroller.address);
        });

        it('should only allow admin to set comptroller', async () => {
            const nonAdmin = wallets.delegate;
            const signers = await hre.ethers.getSigners()
            let newComptroller = signers[3];

            await xINV.connect(nonAdmin)._setComptroller(newComptroller.address);
            expect(await xINV.comptroller()).to.equal(unitroller.address);

            // fail if not real comptroller contract
            await expect(xINV.connect(wallets.deployer)._setComptroller(newComptroller.address)).to.be.reverted;
            expect(await xINV.comptroller()).to.equal(unitroller.address);

            newComptroller = await hre.waffle.deployContract(wallets.deployer, ComptrollerArtifact, []);
            await xINV.connect(wallets.deployer)._setComptroller(newComptroller.address);
            expect(await xINV.comptroller()).to.equal(newComptroller.address);
        });
    });

    describe('admin', function() {

        beforeEach( async () => {
            await supportMarket(xINV.address, unitroller.address);
        });

        it('should return correct admin', async () => {
            expect(await xINV.admin()).to.equal(wallets.deployer.address);
        });

        it('should return correct pending admin', async () => {
            expect(await xINV.pendingAdmin()).to.equal(await address(0));
        });

        it('sets new admin', async () => {
            await xINV.connect(wallets.admin)._setPendingAdmin(wallets.admin.address)
            expect(await xINV.admin()).to.equal(wallets.deployer.address);

            // current admin sets pending admin
            await xINV.connect(wallets.deployer)._setPendingAdmin(wallets.delegate.address);
            await xINV.connect(wallets.deployer)._setPendingAdmin(wallets.admin.address);
            expect(await xINV.pendingAdmin()).to.equal(wallets.admin.address);

            // accept admin
            // first attempt fail from wrong pending admin
            await xINV.connect(wallets.delegate)._acceptAdmin();
            expect(await xINV.pendingAdmin()).to.equal(wallets.admin.address);

            // actual pending admin accepting
            await xINV.connect(wallets.admin)._acceptAdmin();
            expect(await xINV.pendingAdmin()).to.equal(await address(0));
            expect(await xINV.admin()).to.equal(wallets.admin.address);     
        });
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
            await batchMint([ wallets.deployer ], hre.ethers.utils.parseEther("5"));

            // redeem cToken aka xINV for underlying and check balances of both xINV and INV
            await redeem(xINV, wallets.deployer, toRedeem1);

            const escrowPendingWithdrawal = (await timelockEscrow.pendingWithdrawals(wallets.deployer.address))["amount"];
            expect(escrowPendingWithdrawal).to.equal(toRedeem1);
        });

        it('transfers withdrawable directly to redeemer if duration is 0', async () => {
            // approve  and mint
            await batchMint([ wallets.deployer ], hre.ethers.utils.parseEther("5"));

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
            await batchMint([ wallets.deployer ], hre.ethers.utils.parseEther("5"));

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

    describe('XINV minting and redeeming', function() {

        it('should only be minted if allowed by comptroller', async () => {
            await supportMarket(xINV.address, unitroller.address);
            // pause mint
            await pauseMint(unitroller.address, xINV.address);       

            // now attempt mint, should revert
            await batchTransferInv([ wallets.admin ], toMint1);
            
            await inv.connect(wallets.admin).approve(xINV.address, toMint1);
            await expect(xINV.connect(wallets.admin).mint(toMint1)).to.be.revertedWith("revert mint is paused");
        });

        it('should only be minted if user has equal or more amount of INV', async () => {
            await supportMarket(xINV.address, unitroller.address);

            // Approve the transfer of collateral and then transfer to mint xINV.
            await expect(inv.connect(wallets.deployer).approve(xINV.address, toMint1))
                .to.emit(inv, "Approval").withArgs(wallets.deployer.address, xINV.address, toMint1);
            await expect(xINV.connect(wallets.deployer).mint(toMint1)).to.emit(xINV, "Mint");

            expect(await balanceOf(xINV, wallets.deployer.address)).to.equal(toMint1);

            // minting without enough INV
            await expect(xINV.connect(wallets.deployer).mint(toMint1)).to.be.reverted;
        });

        it('should have an underlying balance', async () => {
            await supportMarket(xINV.address, unitroller.address);

            // Approve the transfer of collateral and then transfer to mint xINV.
            await expect(inv.connect(wallets.deployer).approve(xINV.address, toMint1))
                .to.emit(inv, "Approval").withArgs(wallets.deployer.address, xINV.address, toMint1);
            await expect(xINV.connect(wallets.deployer).mint(toMint1)).to.emit(xINV, "Mint");

            // set initially to 1e18
            const exchangeRate = await xINV.exchangeRateStored();
            expect(exchangeRate).to.be.equal(hre.ethers.utils.parseEther("1"));
        
            const underlyingBalance  = await xINV.callStatic.balanceOfUnderlying(wallets.deployer.address)
            const ownerBalance = await balanceOf(xINV, wallets.deployer.address);
            expect(underlyingBalance).to.be.equal(ownerBalance);
        });

        it('should be able to redeem xINV for underlying INV', async() => {
            await supportMarket(xINV.address, unitroller.address);

            // expect failure due to insufficient approval
            await expect(xINV.connect(wallets.deployer).mint(toMint2)).to.be.reverted;

            // approve to spend some more
            await inv.connect(wallets.deployer).approve(xINV.address, hre.ethers.utils.parseEther("5"));
            await expect(xINV.connect(wallets.deployer).mint(toMint2)).to.emit(xINV, "Mint");

            // redeem cToken aka xINV for underlying and check balances of both xINV and INV
            await expect(redeem(xINV, wallets.deployer, toRedeem1)).to.emit(xINV, "Redeem");

            // escrow is used, so should be able to withdraw explicitly after duration
            // escrow is explicitly set to true for redeeming, so fastforward to duration and withdraw
            const timestamp = (await timelockEscrow.pendingWithdrawals(wallets.deployer.address))["withdrawalTimestamp"];
            // increase evm block time just above duration
            await evmSetNextBlockTimestamp(timestamp.toNumber());
            //await evmIncreaseTime(duration.add(60).toNumber());
            await evmMine();

            // withdraw funds from escrow
            const oldBalance = await balanceOf(inv, wallets.deployer.address);
            await expect(timelockEscrow.connect(wallets.deployer).withdraw())
                .to.emit(timelockEscrow, "Withdraw").withArgs(wallets.deployer.address, toRedeem1);
            
            expect(await balanceOf(inv, wallets.deployer.address)).to.be.equal(oldBalance.add(toRedeem1));
        });

        it('should be able to redeem xINV for specified amount of INV', async () => {
            await supportMarket(xINV.address, unitroller.address);

            await batchMint([ wallets.deployer ], hre.ethers.utils.parseEther("5"));

            // instant transfer after redeem
            await timelockEscrow.connect(wallets.deployer)._setEscrowDuration(0);

            const balanceBefore = await balanceOf(inv, wallets.deployer.address);
            await expect(xINV.connect(wallets.deployer).redeemUnderlying(toRedeem1))
                .to.emit(xINV, "Transfer").withArgs(wallets.deployer.address, xINV.address, toRedeem1);
            expect(await balanceOf(inv, wallets.deployer.address)).to.equal(balanceBefore.add(toRedeem1));
        });
    });

    describe('get cash', function () {
        
        it('gets cash prior', async () => {
            await supportMarket(xINV.address, unitroller.address);
            const cash = await xINV.getCash();
            expect(cash).to.be.equal(0);
        });
    })

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

            await batchTransferInv([wallets.admin, wallets.delegate], toMint3);
            await batchMint([wallets.admin, wallets.deployer], toMint3);

            // 2 different delegations to delegate
            expect(await xINV.getCurrentVotes(wallets.delegate.address)).to.equal(0);

            await delegate(xINV, wallets.admin, wallets.delegate.address);
            expect(await xINV.getCurrentVotes(wallets.delegate.address)).to.equal(toMint3);

            await delegate(xINV, wallets.deployer, wallets.delegate.address);
            expect(await xINV.getCurrentVotes(wallets.delegate.address)).to.equal(toMint3.mul(2));
        });
    });

    describe('checkpoints', function () {
        beforeEach(async () => {
            await supportMarket(xINV.address, unitroller.address);

            await batchTransferInv([wallets.admin, wallets.delegate], toMint3);
            await batchMint([wallets.admin, wallets.deployer], toMint3);

            expect(await balanceOf(xINV, wallets.deployer.address)).to.be.equal(toMint3);
            expect(await balanceOf(xINV, wallets.admin.address)).to.be.equal(toMint3);
        });

        it('returns the number of checkpoints for a delegate', async () => {
            const txn1 = await delegate(xINV, wallets.deployer, wallets.delegate.address);
            expect(await xINV.numCheckpoints(wallets.delegate.address)).to.be.equal(1);

            // 2 different delegations to delegate
            const txn2 = await delegate(xINV, wallets.admin, wallets.delegate.address);
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
            await evmSetAutomine(false);

            const stopMiningBlockNumber = await getBlockNumber();

            // # of checkpoints for delegate at this stage should be 0
            expect(await xINV.numCheckpoints(wallets.delegate.address)).to.equal(0);

            // only one of these should be mined in the next block after mining resumed
            await delegate(xINV, wallets.admin, wallets.delegate.address);
            await delegate(xINV, wallets.deployer, wallets.delegate.address);
         
            await evmMine();

            const afterStartMiningBlockNumber = await getBlockNumber();

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

            await evmSetAutomine(true);
        });
    });

    describe('get prior votes of xINV', function () {
        beforeEach( async () => {
            await supportMarket(xINV.address, unitroller.address);

            await batchTransferInv([ wallets.delegate, wallets.admin ], toMint3);
            await batchMint([ wallets.deployer, wallets.admin ], toMint3);
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
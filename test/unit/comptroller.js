const { expect } = require("chai");
const hre = require("hardhat");
const { init, wallets, deployInv, deployXinv, 
    deployComptroller, deployUnitroller,
    supportMarket } = require('../util/xinv');

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
    
    describe('comptroller', () => {
    
        beforeEach( async () => {
            await supportMarket(xINV.address, unitroller.address);
        });
    
        it('should only allow admin to set comptroller', async () => {
            const nonAdmin = wallets.delegate;
            const signers = await hre.ethers.getSigners();
            let newComptroller = signers[3];
    
            await xINV.connect(nonAdmin)._setComptroller(newComptroller.address);
            expect(await xINV.comptroller()).to.equal(unitroller.address);
    
            // fail if not real comptroller contract
            await expect(xINV.connect(wallets.deployer)._setComptroller(newComptroller.address)).to.be.reverted;
            expect(await xINV.comptroller()).to.equal(unitroller.address);
    
            newComptroller = comptroller;
            await xINV.connect(wallets.deployer)._setComptroller(newComptroller.address);
            expect(await xINV.comptroller()).to.equal(newComptroller.address);
        });
    });
});


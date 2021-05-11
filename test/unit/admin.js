const { expect } = require("chai");
const { init, wallets, deployInv, deployXinv, 
    deployComptroller, deployUnitroller,
    supportMarket, address } = require('../util/xinv');

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
    
    describe('admin', () => {

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
            await xINV.connect(wallets.admin)._setPendingAdmin(wallets.admin.address);
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
});
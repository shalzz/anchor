const { expect } = require("chai");
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
    
    describe('get cash', () => {
        
        it('gets cash prior', async () => {
            await supportMarket(xINV.address, unitroller.address);
            const cash = await xINV.getCash();
            expect(cash).to.be.equal(0);
        });
    });
});